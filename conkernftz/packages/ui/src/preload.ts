import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foundry', {
  run: (args: string[]) => ipcRenderer.invoke('foundry:run', args),
  chooseProjectDir: () => ipcRenderer.invoke('foundry:chooseProjectDir'),
  getProjectDir: () => ipcRenderer.invoke('foundry:getProjectDir'),
  readConfig: () => ipcRenderer.invoke('foundry:readConfig'),
  writeConfig: (json: unknown) => ipcRenderer.invoke('foundry:writeConfig', json),
  chooseDirInsideProject: () => ipcRenderer.invoke('foundry:chooseDirInsideProject'),
  readFile: (relativePath: string) => ipcRenderer.invoke('foundry:readFile', relativePath),
  ensureDirs: (relativePaths: string[]) => ipcRenderer.invoke('foundry:ensureDirs', relativePaths),
  listImages: (relativePath: string) => ipcRenderer.invoke('foundry:listImages', relativePath),
  openInExplorer: (relativePath: string) => ipcRenderer.invoke('foundry:openInExplorer', relativePath),
  listDir: (relativePath: string) => ipcRenderer.invoke('foundry:listDir', relativePath),
});


