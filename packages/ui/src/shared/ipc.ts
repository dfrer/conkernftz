// Typed IPC contract shared by the Electron preload bridge (window.foundry) and the
// renderer. This is the single source of truth for the surface the preload must
// expose. `FOUNDRY_METHODS` is asserted against the runtime preload.cjs by a unit
// test, which prevents drift like a method being added to preload.ts/preload.d.ts
// but missed in the hand-written runtime preload.cjs (which is exactly how
// readFileBase64/saveJson went missing before O0).

export interface OkResult {
  ok: boolean;
  error?: string;
}
export interface StdoutResult extends OkResult {
  stdout?: string;
}
export interface ProjectDirResult extends OkResult {
  projectDir?: string;
}
export interface JsonResult extends OkResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;
}
export interface PathResult extends OkResult {
  path?: string;
}
export interface OutDirResult extends OkResult {
  outDir?: string;
}
export interface DeployResult extends OkResult {
  url?: string;
}
export interface ContentResult extends OkResult {
  content?: string;
}
export interface FileBase64Result extends OkResult {
  base64?: string;
  mime?: string;
}
export interface LivePreviewResult extends OkResult {
  format?: string;
  images?: string[];
}
export interface EffectsPreviewResult extends OkResult {
  // Historically declared as `image`; the handler returns `b64` + `format`. Keep all
  // three optional so both the legacy renderer and the new boundary type-check.
  image?: string;
  format?: string;
  b64?: string;
}
export interface CountResult extends OkResult {
  count?: number;
}
export interface ItemsResult extends OkResult {
  items?: string[];
}
export interface FilesResult extends OkResult {
  files?: string[];
}
export interface RenamedResult extends OkResult {
  renamed?: number;
}
export interface AuditResult extends OkResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;
}
export type PackKind = 'pack' | 'back';
export interface PackEntry {
  id: string;
  name: string;
  kind: PackKind;
  builtin: boolean;
}
export interface PacksListResult extends OkResult {
  packs?: PackEntry[];
}
export interface PackImportResult extends OkResult {
  pack?: PackEntry;
}

/**
 * The complete window.foundry surface exposed by the preload bridge. A superset of
 * what any single caller uses, so adding entries never breaks existing renderer code.
 */
export interface FoundryApi {
  run(args: string[]): Promise<StdoutResult>;
  auditAssets(opts?: { json?: boolean }): Promise<AuditResult>;
  auditOutputs(opts?: { images?: boolean; json?: boolean }): Promise<AuditResult>;

  buildWithProgress(count: number): Promise<StdoutResult>;
  pauseBuild(): Promise<OkResult>;
  resumeBuild(): Promise<OkResult>;
  stopBuild(): Promise<OkResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBuildProgress(handler: (data: any) => void): void;

  previewWithProgress(count: number): Promise<StdoutResult>;
  pausePreview(): Promise<OkResult>;
  resumePreview(): Promise<OkResult>;
  stopPreview(): Promise<OkResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPreviewProgress(handler: (data: any) => void): void;

  chooseProjectDir(): Promise<ProjectDirResult>;
  getProjectDir(): Promise<ProjectDirResult>;
  setProjectDir(dir: string): Promise<ProjectDirResult>;
  readConfig(): Promise<JsonResult>;
  readConfigAt(dir: string): Promise<JsonResult>;
  writeConfig(json: unknown): Promise<OkResult>;
  chooseDirInsideProject(): Promise<PathResult>;

  readFile(relativePath: string): Promise<ContentResult>;
  readFileBase64(relativePath: string): Promise<FileBase64Result>;
  previewLive(config: unknown, count: number, seed?: string): Promise<LivePreviewResult>;
  previewEffects(config: unknown): Promise<EffectsPreviewResult>;
  saveJson(relPath: string, json: unknown): Promise<OkResult>;
  ensureDirs(relativePaths: string[]): Promise<OkResult>;
  listImages(relativePath: string): Promise<CountResult>;
  openInExplorer(relativePath: string): Promise<OkResult>;
  listDir(relativePath: string): Promise<ItemsResult>;
  deletePath(relativePath: string): Promise<OkResult>;
  renameFiles(pairs: { from: string; to: string }[]): Promise<RenamedResult>;
  openExternal(url: string): Promise<OkResult>;
  saveBase64(b64: string, relPath: string): Promise<OkResult>;
  listFiles(relDir: string): Promise<FilesResult>;
  deleteFile(relPath: string): Promise<OkResult>;
  /** Generate the deployable static mint site into <project>/site-export. */
  exportSite(payload: { dataJs: string; dataFile: string }): Promise<OutDirResult>;
  /** Deploy <project>/site-export to a host (currently Vercel via the user's token). */
  deploySite(payload: { provider: string; token: string }): Promise<DeployResult>;
  /** Serve <project>/site-export over http://127.0.0.1 and open it (local preview, no file://). */
  previewSite(): Promise<DeployResult>;

  // App-level pack & card-back library (project-independent; built-ins + userData).
  packsList(): Promise<PacksListResult>;
  packsRead(id: string): Promise<FileBase64Result>;
  packsImport(opts: { name?: string; kind?: PackKind }): Promise<PackImportResult>;
  packsDelete(id: string): Promise<OkResult>;
}

/**
 * Every method the preload bridge must expose. Kept in lockstep with `FoundryApi`
 * (a type-level check below fails to compile if they diverge) and asserted against
 * the runtime preload.cjs by preload-contract.test.ts.
 */
export const FOUNDRY_METHODS = [
  'run',
  'auditAssets',
  'auditOutputs',
  'buildWithProgress',
  'pauseBuild',
  'resumeBuild',
  'stopBuild',
  'onBuildProgress',
  'previewWithProgress',
  'pausePreview',
  'resumePreview',
  'stopPreview',
  'onPreviewProgress',
  'chooseProjectDir',
  'getProjectDir',
  'setProjectDir',
  'readConfig',
  'readConfigAt',
  'writeConfig',
  'chooseDirInsideProject',
  'readFile',
  'readFileBase64',
  'previewLive',
  'previewEffects',
  'saveJson',
  'ensureDirs',
  'listImages',
  'openInExplorer',
  'listDir',
  'deletePath',
  'renameFiles',
  'openExternal',
  'saveBase64',
  'listFiles',
  'deleteFile',
  'exportSite',
  'deploySite',
  'previewSite',
  'packsList',
  'packsRead',
  'packsImport',
  'packsDelete',
] as const;

export type FoundryMethod = (typeof FOUNDRY_METHODS)[number];

// Compile-time guard: FOUNDRY_METHODS must list exactly the keys of FoundryApi.
// If a method is added to one but not the other, this assignment fails to type-check.
type _AssertNoExtraKeys = Exclude<FoundryMethod, keyof FoundryApi> extends never ? true : never;
type _AssertNoMissingKeys = Exclude<keyof FoundryApi, FoundryMethod> extends never ? true : never;
const _assertKeysMatch: [_AssertNoExtraKeys, _AssertNoMissingKeys] = [true, true];
void _assertKeysMatch;
