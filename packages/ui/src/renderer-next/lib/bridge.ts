// Optional, typed access to the Electron preload bridge (window.foundry). It is absent
// in the browser and in tests, so every caller must handle `undefined`. A local interface
// (rather than importing the main-process contract) keeps renderer-next self-contained
// under its own tsconfig. Expand as the new screens consume more channels.

export interface OkResult {
  ok: boolean;
  error?: string;
}

export interface BuildProgressEvent {
  current: number;
  total: number;
  progress: number;
  message?: string;
  isPaused?: boolean;
}

export interface FoundryBridge {
  getProjectDir(): Promise<{ ok: boolean; projectDir?: string }>;
  setProjectDir(dir: string): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
  chooseProjectDir(): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
  readConfig(): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  readConfigAt(dir: string): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  writeConfig(json: unknown): Promise<OkResult>;
  saveJson(relPath: string, json: unknown): Promise<OkResult>;
  saveBase64(b64: string, relPath: string): Promise<OkResult>;
  readFile(relativePath: string): Promise<{ ok: boolean; content?: string; error?: string }>;
  listImages(relativePath: string): Promise<{ ok: boolean; count?: number; error?: string }>;
  listDir(relativePath: string): Promise<{ ok: boolean; items?: string[]; error?: string }>;
  renameFiles(pairs: { from: string; to: string }[]): Promise<{ ok: boolean; renamed?: number; error?: string }>;
  previewLive(
    config: unknown,
    count: number,
    seed?: string,
  ): Promise<{ ok: boolean; format?: string; images?: string[]; error?: string }>;
  buildWithProgress(count: number): Promise<{ ok: boolean; stdout?: string; error?: string }>;
  pauseBuild(): Promise<OkResult>;
  resumeBuild(): Promise<OkResult>;
  stopBuild(): Promise<OkResult>;
  onBuildProgress(handler: (data: BuildProgressEvent) => void): void;
  auditAssets(opts?: { json?: boolean }): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  auditOutputs(opts?: { images?: boolean; json?: boolean }): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  /** Run the conkernftz CLI in the active project (upload / mint / deploy / candy …). */
  run(args: string[]): Promise<{ ok: boolean; stdout?: string; error?: string }>;
  openInExplorer(relativePath: string): Promise<OkResult>;
  openExternal(url: string): Promise<OkResult>;
  /** Generate the deployable static mint site; returns the output folder. */
  exportSite(payload: { dataJs: string; dataFile: string }): Promise<{ ok: boolean; outDir?: string; error?: string }>;
}

export function bridge(): FoundryBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { foundry?: FoundryBridge }).foundry;
}

export function isBridged(): boolean {
  return !!bridge();
}
