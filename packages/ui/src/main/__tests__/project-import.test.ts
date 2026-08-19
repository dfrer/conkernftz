import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { dialog } = vi.hoisted(() => ({ dialog: { showOpenDialog: vi.fn() } }));
vi.mock('electron', () => ({ dialog }));

import { importProjectDirectory, importProjectFolder } from '../project-import.js';

const temporaryDirectories: string[] = [];

async function makeProject(name = 'Neon Collection!'): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `${name.replace(/[^a-z0-9]/gi, '') || 'project'}-`));
  temporaryDirectories.push(directory);
  return directory;
}

async function addAsset(directory: string, relativePath: string): Promise<void> {
  const target = path.join(directory, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, 'asset');
}

async function readConfig(directory: string): Promise<Record<string, any>> {
  return JSON.parse(await fs.readFile(path.join(directory, 'foundry.config.json'), 'utf8'));
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('project import', () => {
  it('uses a case-insensitive Layers container, naturally sorts layers, and emits slash paths', async () => {
    const project = await makeProject('Neon Collection!');
    await addAsset(project, 'Layers/Layer10/ten.PNG');
    await addAsset(project, 'Layers/Layer2/first.png');
    await addAsset(project, 'Layers/Layer2/second.webp');
    await addAsset(project, 'Layers/.Hidden/ignored.svg');
    await addAsset(project, 'Layers/Notes/readme.txt');
    await addAsset(project, 'RootOnly/not-used.png');
    await fs.writeFile(path.join(project, 'root-file.png'), 'not a layer');

    const result = await importProjectDirectory(project);

    expect(result).toMatchObject({
      ok: true,
      projectDir: await fs.realpath(project),
      created: true,
      layerCount: 2,
      layerNames: ['Layer2', 'Layer10'],
      ignoredDirectories: ['.Hidden', 'Notes'],
    });
    const config = await readConfig(project);
    expect(result.config).toEqual(config);
    expect(config).toMatchObject({
      name: path.basename(await fs.realpath(project)),
      symbol: 'NEONCOLL',
      description: '',
      editionSize: 2,
      image: { width: 1024, height: 1024, background: 'transparent' },
      rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
      uniqueness: { hash: 'sha256', ignore: [] },
      export: { outDir: 'build', imageFormat: 'png' },
      storage: { provider: 'local', local: { outDir: 'upload' } },
      chain: { target: 'evm' },
    });
    expect(config.layers).toEqual([
      { name: 'Layer2', path: 'Layers/Layer2', rarity: 'filename', required: true },
      { name: 'Layer10', path: 'Layers/Layer10', rarity: 'filename', required: true },
    ]);
    expect((await fs.readFile(path.join(project, 'foundry.config.json'), 'utf8')).endsWith('\n')).toBe(true);
  });

  it('infers root-direct image directories and caps the asset-product edition size at 100', async () => {
    const project = await makeProject();
    for (let index = 0; index < 11; index++) await addAsset(project, `Background/asset-${index}.gif`);
    for (let index = 0; index < 10; index++) await addAsset(project, `Body/asset-${index}.svg`);
    await addAsset(project, '.cache/hidden.png');
    await fs.mkdir(path.join(project, 'Empty'));
    await addAsset(project, 'build/generated.png');
    await addAsset(project, 'OUTPUT/generated.webp');
    await addAsset(project, 'site-export/generated.svg');

    const result = await importProjectDirectory(project);

    expect(result).toMatchObject({
      ok: true,
      layerNames: ['Background', 'Body'],
      ignoredDirectories: ['.cache', 'build', 'Empty', 'OUTPUT', 'site-export'],
    });
    const config = await readConfig(project);
    expect(config.editionSize).toBe(100);
    expect(config.layers.map((layer: { path: string }) => layer.path)).toEqual(['Background', 'Body']);
  });

  it('caps edition size by unique parsed trait values instead of files or rarity-weight variants', async () => {
    const project = await makeProject();
    await addAsset(project, 'Background/Blue.png');
    await addAsset(project, 'Background/Blue.webp');
    await addAsset(project, 'Background/Red#1.png');
    await addAsset(project, 'Background/Red#2.png');
    await addAsset(project, 'Body/Astronaut.svg');
    await addAsset(project, 'Body/Robot.gif');

    await expect(importProjectDirectory(project)).resolves.toMatchObject({ ok: true, layerCount: 2 });
    expect((await readConfig(project)).editionSize).toBe(4);
  });

  it('does not filter reserved output names inside an explicit Layers container', async () => {
    const project = await makeProject();
    await addAsset(project, 'Layers/build/asset.png');
    await addAsset(project, 'Layers/metadata/asset.svg');

    const result = await importProjectDirectory(project);

    expect(result).toMatchObject({ ok: true, layerNames: ['build', 'metadata'] });
    expect((await readConfig(project)).layers.map((layer: { path: string }) => layer.path)).toEqual([
      'Layers/build',
      'Layers/metadata',
    ]);
  });

  it('rejects multiple case-insensitive Layers containers without creating a config', async () => {
    const project = await makeProject();
    const readdir = vi.spyOn(fs, 'readdir').mockResolvedValueOnce([
      { name: 'Layers', isDirectory: () => true },
      { name: 'LAYERS', isDirectory: () => true },
    ] as any);

    try {
      await expect(importProjectDirectory(project)).resolves.toEqual({
        ok: false,
        error: 'Could not inspect selected directory: Multiple Layers folders were found. Keep only one Layers folder or select a more specific folder.',
      });
    } finally {
      readdir.mockRestore();
    }
    await expect(fs.access(path.join(project, 'foundry.config.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('opens an existing valid config without modifying it', async () => {
    const project = await makeProject();
    const configPath = path.join(project, 'foundry.config.json');
    const original = `${JSON.stringify(
      {
        name: 'Existing collection',
        editionSize: 1,
        image: { width: 1024, height: 1024, background: 'transparent' },
        layers: [{ name: 'Background', path: 'Layers/Background', rarity: 'filename', required: true }],
        rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
        uniqueness: { hash: 'sha256', ignore: [] },
        export: { outDir: 'build', imageFormat: 'png' },
        storage: { provider: 'local', local: { outDir: 'upload' } },
        chain: { target: 'evm' },
        customExtension: { preserve: true },
      },
      null,
      2,
    )}\n`;
    await fs.writeFile(configPath, original);

    const result = await importProjectDirectory(project);
    expect(result).toMatchObject({
      ok: true,
      projectDir: await fs.realpath(project),
      created: false,
    });
    expect(result.config).toEqual(JSON.parse(original));
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(original);
  });

  it('rejects a schema-invalid config object without modifying it', async () => {
    const project = await makeProject();
    const configPath = path.join(project, 'foundry.config.json');
    const original = '{\n  "custom": true\n}\n';
    await fs.writeFile(configPath, original);

    const result = await importProjectDirectory(project);

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('Existing foundry.config.json is not a valid ConkerNFTZ project'),
    });
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(original);
  });

  it.each([
    ['malformed JSON', '{not-json', 'Existing foundry.config.json is not valid JSON'],
    ['a JSON array', '[]', 'Existing foundry.config.json must contain a JSON object'],
  ])('rejects an existing %s without changing it', async (_description, original, error) => {
    const project = await makeProject();
    const configPath = path.join(project, 'foundry.config.json');
    await fs.writeFile(configPath, original);

    await expect(importProjectDirectory(project)).resolves.toEqual({ ok: false, error });
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(original);
  });

  it('rejects folders with no usable layer directories and does not create a config', async () => {
    const project = await makeProject();
    await addAsset(project, '.Hidden/asset.png');
    await addAsset(project, 'Documents/readme.txt');

    await expect(importProjectDirectory(project)).resolves.toMatchObject({
      ok: false,
      error: 'No usable layer directories with direct PNG, WebP, GIF, or SVG files were found',
      ignoredDirectories: ['.Hidden', 'Documents'],
    });
    await expect(fs.access(path.join(project, 'foundry.config.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns an explicit cancellation from the native picker without inspecting a folder', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    await expect(importProjectFolder()).resolves.toEqual({ ok: false, cancelled: true });
  });
});
