// Optional, typed access to the Electron preload bridge (window.foundry). It is absent
// in the browser and in tests, so every caller must handle `undefined`. A local interface
// (rather than importing the main-process contract) keeps renderer-next self-contained
// under its own tsconfig. Expand as the new screens consume more channels.

export interface OkResult {
  ok: boolean;
  error?: string;
}

export interface FoundryBridge {
  getProjectDir(): Promise<{ ok: boolean; projectDir?: string }>;
  setProjectDir(dir: string): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
  chooseProjectDir(): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
  readConfig(): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  readConfigAt(dir: string): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  openExternal(url: string): Promise<OkResult>;
}

export function bridge(): FoundryBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { foundry?: FoundryBridge }).foundry;
}

export function isBridged(): boolean {
  return !!bridge();
}
