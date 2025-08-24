import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foundry', {
  run: (args: string[]) => ipcRenderer.invoke('foundry:run', args),
  chooseProjectDir: () => ipcRenderer.invoke('foundry:chooseProjectDir'),
  getProjectDir: () => ipcRenderer.invoke('foundry:getProjectDir'),
  setProjectDir: (dir: string) => ipcRenderer.invoke('foundry:setProjectDir', dir),
  readConfig: () => ipcRenderer.invoke('foundry:readConfig'),
  readConfigAt: (dir: string) => ipcRenderer.invoke('foundry:readConfigAt', dir),
  writeConfig: (json: unknown) => ipcRenderer.invoke('foundry:writeConfig', json),
  chooseDirInsideProject: () => ipcRenderer.invoke('foundry:chooseDirInsideProject'),
  readFile: (relativePath: string) => ipcRenderer.invoke('foundry:readFile', relativePath),
  ensureDirs: (relativePaths: string[]) => ipcRenderer.invoke('foundry:ensureDirs', relativePaths),
  listImages: (relativePath: string) => ipcRenderer.invoke('foundry:listImages', relativePath),
  openInExplorer: (relativePath: string) => ipcRenderer.invoke('foundry:openInExplorer', relativePath),
  listDir: (relativePath: string) => ipcRenderer.invoke('foundry:listDir', relativePath),
  renameFiles: (pairs: { from: string; to: string }[]) => ipcRenderer.invoke('foundry:renameFiles', pairs),
  openExternal: (url: string) => ipcRenderer.invoke('foundry:openExternal', url),
});


