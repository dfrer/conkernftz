export {}; // module
declare global {
  interface Window {
    foundry: {
      run(args: string[]): Promise<{ ok: boolean; stdout?: string; error?: string }>;
      chooseProjectDir(): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
      getProjectDir(): Promise<{ ok: boolean; projectDir?: string }>;
      setProjectDir(dir: string): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
      readConfig(): Promise<{ ok: boolean; json?: any; error?: string }>;
      readConfigAt(dir: string): Promise<{ ok: boolean; json?: any; error?: string }>;
      writeConfig(json: unknown): Promise<{ ok: boolean; error?: string }>;
      chooseDirInsideProject(): Promise<{ ok: boolean; path?: string; error?: string }>;
      readFile(relativePath: string): Promise<{ ok: boolean; content?: string; error?: string }>;
      ensureDirs(relativePaths: string[]): Promise<{ ok: boolean; error?: string }>;
      listImages(relativePath: string): Promise<{ ok: boolean; count?: number; error?: string }>;
      openInExplorer(relativePath: string): Promise<{ ok: boolean; error?: string }>;
      listDir(relativePath: string): Promise<{ ok: boolean; items?: string[]; error?: string }>;
      renameFiles(pairs: { from: string; to: string }[]): Promise<{ ok: boolean; renamed?: number; error?: string }>;
    };
  }
}


