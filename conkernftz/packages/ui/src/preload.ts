import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('conkernftz', {
  run: (args: string[]) => ipcRenderer.invoke('conkernftz:run', args),
  chooseProjectDir: () => ipcRenderer.invoke('conkernftz:chooseProjectDir'),
  getProjectDir: () => ipcRenderer.invoke('conkernftz:getProjectDir'),
  setProjectDir: (dir: string) => ipcRenderer.invoke('conkernftz:setProjectDir', dir),
  readConfig: () => ipcRenderer.invoke('conkernftz:readConfig'),
  readConfigAt: (dir: string) => ipcRenderer.invoke('conkernftz:readConfigAt', dir),
  writeConfig: (json: unknown) => ipcRenderer.invoke('conkernftz:writeConfig', json),
  chooseDirInsideProject: () => ipcRenderer.invoke('conkernftz:chooseDirInsideProject'),
  readFile: (relativePath: string) => ipcRenderer.invoke('conkernftz:readFile', relativePath),
  ensureDirs: (relativePaths: string[]) => ipcRenderer.invoke('conkernftz:ensureDirs', relativePaths),
  listImages: (relativePath: string) => ipcRenderer.invoke('conkernftz:listImages', relativePath),
  openInExplorer: (relativePath: string) => ipcRenderer.invoke('conkernftz:openInExplorer', relativePath),
  listDir: (relativePath: string) => ipcRenderer.invoke('conkernftz:listDir', relativePath),
  renameFiles: (pairs: { from: string; to: string }[]) => ipcRenderer.invoke('conkernftz:renameFiles', pairs),
  openExternal: (url: string) => ipcRenderer.invoke('conkernftz:openExternal', url),
});


