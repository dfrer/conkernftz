import * as electron from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dynamicImport } from './dynamic-import.js';

const CONFIG_FILE = 'foundry.config.json';
const SUPPORTED_ASSET_EXTENSIONS = new Set(['.png', '.webp', '.gif', '.svg']);
const ROOT_DIRECT_IGNORED_DIRECTORIES = new Set([
  'build',
  'dist',
  'keys',
  'metadata',
  'node_modules',
  'output',
  'outputs',
  'preview',
  'previews',
  'site-export',
  'upload',
  'uploads',
]);
const naturalNameOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const GENERATED_RARITY = { mode: 'filenameDelimiter' as const, delimiter: '#', defaultWeight: 1 };

interface CoreProjectConfigModule {
  ProjectConfigSchema: {
    safeParse(value: unknown):
      | { success: true }
      | { success: false; error: { issues: Array<{ path: Array<string | number>; message: string }> } };
  };
}

interface CoreCatalogModule {
  extractTraitValueFromFilename(
    filename: string,
    rarity: { mode: 'filenameDelimiter'; delimiter: string; defaultWeight: number },
  ): string;
}

let coreConfigPromise: Promise<CoreProjectConfigModule> | null = null;
let coreCatalogPromise: Promise<CoreCatalogModule> | null = null;

function loadCoreConfig(): Promise<CoreProjectConfigModule> {
  coreConfigPromise ??= dynamicImport<CoreProjectConfigModule>('@conkernftz/core/project-config');
  return coreConfigPromise;
}

function loadCoreCatalog(): Promise<CoreCatalogModule> {
  coreCatalogPromise ??= dynamicImport<CoreCatalogModule>('@conkernftz/core/catalog');
  return coreCatalogPromise;
}

export interface ImportProjectResult {
  ok: boolean;
  error?: string;
  cancelled?: boolean;
  projectDir?: string;
  config?: unknown;
  created?: boolean;
  layerCount?: number;
  layerNames?: string[];
  ignoredDirectories?: string[];
}

interface InferredLayer {
  name: string;
  absolutePath: string;
  uniqueTraitCount: number;
}

function compareNaturally(left: string, right: string): number {
  const comparison = naturalNameOrder.compare(left, right);
  return comparison || (left < right ? -1 : left > right ? 1 : 0);
}

function isSupportedAsset(name: string): boolean {
  return SUPPORTED_ASSET_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function toSlashPath(value: string): string {
  return value.split(path.sep).join('/');
}

function deriveSymbol(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'COLL';
}

async function countDirectTraitValues(directory: string): Promise<number> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const supportedNames = entries.filter((entry) => entry.isFile() && isSupportedAsset(entry.name)).map((entry) => entry.name);
  if (supportedNames.length === 0) return 0;
  const { extractTraitValueFromFilename } = await loadCoreCatalog();
  return new Set(supportedNames.map((name) => extractTraitValueFromFilename(name, GENERATED_RARITY))).size;
}

async function inferLayers(directory: string): Promise<{ layers: InferredLayer[]; ignoredDirectories: string[] }> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => compareNaturally(left.name, right.name));
  const layersContainers = directories.filter((entry) => entry.name.toLowerCase() === 'layers');
  if (layersContainers.length > 1) {
    throw new Error('Multiple Layers folders were found. Keep only one Layers folder or select a more specific folder.');
  }
  const sourceDirectory = layersContainers.length === 1 ? path.join(directory, layersContainers[0]!.name) : directory;
  const usesExplicitLayersContainer = sourceDirectory !== directory;
  const candidates =
    sourceDirectory === directory
      ? directories
      : (await fs.readdir(sourceDirectory, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .sort((left, right) => compareNaturally(left.name, right.name));

  const layers: InferredLayer[] = [];
  const ignoredDirectories: string[] = [];
  for (const entry of candidates) {
    if (entry.name.startsWith('.') || (!usesExplicitLayersContainer && ROOT_DIRECT_IGNORED_DIRECTORIES.has(entry.name.toLowerCase()))) {
      ignoredDirectories.push(entry.name);
      continue;
    }
    const absolutePath = path.join(sourceDirectory, entry.name);
    const uniqueTraitCount = await countDirectTraitValues(absolutePath);
    if (uniqueTraitCount === 0) {
      ignoredDirectories.push(entry.name);
      continue;
    }
    layers.push({ name: entry.name, absolutePath, uniqueTraitCount });
  }

  return { layers, ignoredDirectories };
}

function createConfig(projectDir: string, layers: InferredLayer[]): Record<string, unknown> {
  const name = path.basename(projectDir);
  const editionSize = layers.reduce((product, layer) => Math.min(100, product * layer.uniqueTraitCount), 1);
  return {
    name,
    symbol: deriveSymbol(name),
    description: '',
    editionSize,
    image: { width: 1024, height: 1024, background: 'transparent' },
    layers: layers.map((layer) => ({
      name: layer.name,
      path: toSlashPath(path.relative(projectDir, layer.absolutePath)),
      rarity: 'filename',
      required: true,
    })),
    rarity: GENERATED_RARITY,
    uniqueness: { hash: 'sha256', ignore: [] },
    export: { outDir: 'build', imageFormat: 'png' },
    storage: { provider: 'local', local: { outDir: 'upload' } },
    chain: { target: 'evm' },
  };
}

async function readExistingConfig(configPath: string): Promise<ImportProjectResult | null> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return { ok: false, error: `Could not read ${CONFIG_FILE}: ${String((error as Error)?.message ?? error)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: `Existing ${CONFIG_FILE} is not valid JSON` };
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    return { ok: false, error: `Existing ${CONFIG_FILE} must contain a JSON object` };
  }
  try {
    const { ProjectConfigSchema } = await loadCoreConfig();
    const result = ProjectConfigSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const location = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      return {
        ok: false,
        error: `Existing ${CONFIG_FILE} is not a valid ConkerNFTZ project: ${location}${issue?.message ?? 'schema validation failed'}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: `Could not validate existing ${CONFIG_FILE}: ${String((error as Error)?.message ?? error)}`,
    };
  }
  return { ok: true, created: false, config: parsed };
}

/**
 * Inspect an already-selected art folder and create its config only when it has no
 * existing config. This function never changes the active Electron project state.
 */
export async function importProjectDirectory(selectedDirectory: string): Promise<ImportProjectResult> {
  let projectDir: string;
  try {
    projectDir = await fs.realpath(selectedDirectory);
    const info = await fs.stat(projectDir);
    if (!info.isDirectory()) return { ok: false, error: 'Selected path is not a directory' };
  } catch (error) {
    return { ok: false, error: `Could not access selected directory: ${String((error as Error)?.message ?? error)}` };
  }

  const configPath = path.join(projectDir, CONFIG_FILE);
  const existing = await readExistingConfig(configPath);
  if (existing) return existing.ok ? { ...existing, projectDir } : existing;

  let inferred: { layers: InferredLayer[]; ignoredDirectories: string[] };
  try {
    inferred = await inferLayers(projectDir);
  } catch (error) {
    return { ok: false, error: `Could not inspect selected directory: ${String((error as Error)?.message ?? error)}` };
  }
  if (inferred.layers.length === 0) {
    return {
      ok: false,
      error: 'No usable layer directories with direct PNG, WebP, GIF, or SVG files were found',
      ignoredDirectories: inferred.ignoredDirectories,
    };
  }

  const config = createConfig(projectDir, inferred.layers);
  try {
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return { ok: false, error: `${CONFIG_FILE} already exists and was not changed` };
    }
    return { ok: false, error: `Could not create ${CONFIG_FILE}: ${String((error as Error)?.message ?? error)}` };
  }

  return {
    ok: true,
    projectDir,
    config,
    created: true,
    layerCount: inferred.layers.length,
    layerNames: inferred.layers.map((layer) => layer.name),
    ignoredDirectories: inferred.ignoredDirectories,
  };
}

/** Open the native directory picker, then import the chosen folder. */
export async function importProjectFolder(): Promise<ImportProjectResult> {
  try {
    const selection = await electron.dialog.showOpenDialog({
      title: 'Import art folder',
      properties: ['openDirectory'],
    });
    if (selection.canceled || selection.filePaths.length === 0) return { ok: false, cancelled: true };
    return importProjectDirectory(selection.filePaths[0]!);
  } catch (error) {
    return { ok: false, error: `Could not choose folder: ${String((error as Error)?.message ?? error)}` };
  }
}
