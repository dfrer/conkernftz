import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foundry', {
  run: (args: string[]) => ipcRenderer.invoke('foundry:run', args),
  buildWithProgress: (count: number) => ipcRenderer.invoke('foundry:buildWithProgress', count),
  pauseBuild: () => ipcRenderer.invoke('foundry:pauseBuild'),
  resumeBuild: () => ipcRenderer.invoke('foundry:resumeBuild'),
  stopBuild: () => ipcRenderer.invoke('foundry:stopBuild'),
  onBuildProgress: (handler: (data: any) => void) => {
    ipcRenderer.on('build-progress', (_evt, data) => handler(data));
  },
  previewWithProgress: (count: number) => ipcRenderer.invoke('foundry:previewWithProgress', count),
  pausePreview: () => ipcRenderer.invoke('foundry:pausePreview'),
  resumePreview: () => ipcRenderer.invoke('foundry:resumePreview'),
  stopPreview: () => ipcRenderer.invoke('foundry:stopPreview'),
  onPreviewProgress: (handler: (data: any) => void) => {
    ipcRenderer.on('preview-progress', (_evt, data) => handler(data));
  },
  chooseProjectDir: () => ipcRenderer.invoke('foundry:chooseProjectDir'),
  getProjectDir: () => ipcRenderer.invoke('foundry:getProjectDir'),
  setProjectDir: (dir: string) => ipcRenderer.invoke('foundry:setProjectDir', dir),
  readConfig: () => ipcRenderer.invoke('foundry:readConfig'),
  readConfigAt: (dir: string) => ipcRenderer.invoke('foundry:readConfigAt', dir),
  writeConfig: (json: unknown) => ipcRenderer.invoke('foundry:writeConfig', json),
  previewEffects: (config: unknown) => ipcRenderer.invoke('foundry:previewEffects', config),
  previewLive: (config: unknown, count: number, seed?: string) => ipcRenderer.invoke('foundry:previewLive', config, count, seed),
  chooseDirInsideProject: () => ipcRenderer.invoke('foundry:chooseDirInsideProject'),
  readFile: (relativePath: string) => ipcRenderer.invoke('foundry:readFile', relativePath),
  ensureDirs: (relativePaths: string[]) => ipcRenderer.invoke('foundry:ensureDirs', relativePaths),
  listImages: (relativePath: string) => ipcRenderer.invoke('foundry:listImages', relativePath),
  openInExplorer: (relativePath: string) => ipcRenderer.invoke('foundry:openInExplorer', relativePath),
  listDir: (relativePath: string) => ipcRenderer.invoke('foundry:listDir', relativePath),
  deletePath: (relativePath: string) => ipcRenderer.invoke('foundry:deletePath', relativePath),
  renameFiles: (pairs: { from: string; to: string }[]) => ipcRenderer.invoke('foundry:renameFiles', pairs),
  openExternal: (url: string) => ipcRenderer.invoke('foundry:openExternal', url),
  saveBase64: (b64: string, relPath: string) => ipcRenderer.invoke('foundry:fsSave', b64, relPath),
  listFiles: (relDir: string) => ipcRenderer.invoke('foundry:fsList', relDir),
  deleteFile: (relPath: string) => ipcRenderer.invoke('foundry:fsDelete', relPath),
  saveJson: (relPath: string, json: unknown) => ipcRenderer.invoke('foundry:saveJson', relPath, json),
});
