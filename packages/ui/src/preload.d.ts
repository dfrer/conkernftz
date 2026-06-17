export {}; // module
declare global {
  interface Window {
    foundry: {
      run(args: string[]): Promise<{ ok: boolean; stdout?: string; error?: string }>;
      buildWithProgress(count: number): Promise<{ ok: boolean; stdout?: string; error?: string }>;
      pauseBuild(): Promise<{ ok: boolean }>;
      resumeBuild(): Promise<{ ok: boolean }>;
      stopBuild(): Promise<{ ok: boolean }>;
      onBuildProgress(handler: (data: any) => void): void;
      previewWithProgress(count: number): Promise<{ ok: boolean; stdout?: string; error?: string }>;
      pausePreview(): Promise<{ ok: boolean }>;
      resumePreview(): Promise<{ ok: boolean }>;
      stopPreview(): Promise<{ ok: boolean }>;
      onPreviewProgress(handler: (data: any) => void): void;
      chooseProjectDir(): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
      getProjectDir(): Promise<{ ok: boolean; projectDir?: string }>;
      setProjectDir(dir: string): Promise<{ ok: boolean; projectDir?: string; error?: string }>;
      readConfig(): Promise<{ ok: boolean; json?: any; error?: string }>;
      readConfigAt(dir: string): Promise<{ ok: boolean; json?: any; error?: string }>;
      writeConfig(json: unknown): Promise<{ ok: boolean; error?: string }>;
      chooseDirInsideProject(): Promise<{ ok: boolean; path?: string; error?: string }>;
      readFile(relativePath: string): Promise<{ ok: boolean; content?: string; error?: string }>;
      readFileBase64(relativePath: string): Promise<{ ok: boolean; base64?: string; mime?: string; error?: string }>;
      previewLive(config: unknown, count: number, seed?: string): Promise<{ ok: boolean; format?: string; images?: string[]; error?: string }>;
      previewEffects(config: unknown): Promise<{ ok: boolean; image?: string; error?: string }>;
      saveJson(relPath: string, json: unknown): Promise<{ ok: boolean; error?: string }>;
      ensureDirs(relativePaths: string[]): Promise<{ ok: boolean; error?: string }>;
      listImages(relativePath: string): Promise<{ ok: boolean; count?: number; error?: string }>;
      openInExplorer(relativePath: string): Promise<{ ok: boolean; error?: string }>;
      listDir(relativePath: string): Promise<{ ok: boolean; items?: string[]; error?: string }>;
      deletePath(relativePath: string): Promise<{ ok: boolean; error?: string }>;
      renameFiles(pairs: { from: string; to: string }[]): Promise<{ ok: boolean; renamed?: number; error?: string }>;
      openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
      saveBase64(b64: string, relPath: string): Promise<{ ok: boolean; error?: string }>;
      listFiles(relDir: string): Promise<{ ok: boolean; files?: string[]; error?: string }>;
      deleteFile(relPath: string): Promise<{ ok: boolean; error?: string }>;
    };
  }
}

