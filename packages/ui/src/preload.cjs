// CommonJS preload to ensure Electron can load without ESM import errors
// Mirrors the API exposed by src/preload.ts
// (Loaded via BrowserWindow.webPreferences.preload)

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('foundry', {
  run: (args) => ipcRenderer.invoke('foundry:run', args),
  chooseProjectDir: () => ipcRenderer.invoke('foundry:chooseProjectDir'),
  getProjectDir: () => ipcRenderer.invoke('foundry:getProjectDir'),
  setProjectDir: (dir) => ipcRenderer.invoke('foundry:setProjectDir', dir),
  readConfig: () => ipcRenderer.invoke('foundry:readConfig'),
  readConfigAt: (dir) => ipcRenderer.invoke('foundry:readConfigAt', dir),
  writeConfig: (json) => ipcRenderer.invoke('foundry:writeConfig', json),
  chooseDirInsideProject: () => ipcRenderer.invoke('foundry:chooseDirInsideProject'),
  readFile: (relativePath) => ipcRenderer.invoke('foundry:readFile', relativePath),
  ensureDirs: (relativePaths) => ipcRenderer.invoke('foundry:ensureDirs', relativePaths),
  listImages: (relativePath) => ipcRenderer.invoke('foundry:listImages', relativePath),
  openInExplorer: (relativePath) => ipcRenderer.invoke('foundry:openInExplorer', relativePath),
  listDir: (relativePath) => ipcRenderer.invoke('foundry:listDir', relativePath),
  renameFiles: (pairs) => ipcRenderer.invoke('foundry:renameFiles', pairs),
  openExternal: (url) => ipcRenderer.invoke('foundry:openExternal', url),
  saveBase64: (b64, relPath) => ipcRenderer.invoke('foundry:fsSave', b64, relPath),
  listFiles: (relDir) => ipcRenderer.invoke('foundry:fsList', relDir),
  deleteFile: (relPath) => ipcRenderer.invoke('foundry:fsDelete', relPath),
});

