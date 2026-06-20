import { contextBridge, ipcRenderer } from 'electron';
import type { FoundryApi } from './shared/ipc.js';

// Typed against the shared contract so the TS compiler fails the build if a method
// is missing or mis-shaped. The runtime bridge is preload.cjs (loaded by Electron);
// preload-contract.test.ts asserts the two stay in sync.
const foundryApi: FoundryApi = {
  run: (args: string[]) => ipcRenderer.invoke('foundry:run', args),
  auditAssets: (opts: { json?: boolean }) => ipcRenderer.invoke('foundry:auditAssets', opts || {}),
  auditOutputs: (opts: { images?: boolean; json?: boolean }) => ipcRenderer.invoke('foundry:auditOutputs', opts || {}),
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
  readFileBase64: (relativePath: string) => ipcRenderer.invoke('foundry:readFileBase64', relativePath),
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
  exportSite: (payload: { dataJs: string; dataFile: string }) => ipcRenderer.invoke('foundry:exportSite', payload),
  deploySite: (payload: { provider: string; token?: string; siteId?: string; repo?: string; branch?: string; domain?: string }) =>
    ipcRenderer.invoke('foundry:deploySite', payload),
  previewSite: () => ipcRenderer.invoke('foundry:previewSite'),
  pickImage: () => ipcRenderer.invoke('foundry:pickImage'),
  packsList: () => ipcRenderer.invoke('foundry:packsList'),
  packsRead: (id: string) => ipcRenderer.invoke('foundry:packsRead', id),
  packsImport: (opts: { name?: string; kind?: 'pack' | 'back' }) => ipcRenderer.invoke('foundry:packsImport', opts || {}),
  packsDelete: (id: string) => ipcRenderer.invoke('foundry:packsDelete', id),
  launchStatus: () => ipcRenderer.invoke('foundry:launchStatus'),
  launchEstimate: () => ipcRenderer.invoke('foundry:launchEstimate'),
  launchDeploy: (opts?: { confirm?: string }) => ipcRenderer.invoke('foundry:launchDeploy', opts || {}),
  launchSetCaps: (opts: { publicWalletCap: number; maxPerTx: number; confirm?: string }) => ipcRenderer.invoke('foundry:launchSetCaps', opts),
  launchSetPrices: (opts: { allowlistEth: string; publicEth: string; confirm?: string }) => ipcRenderer.invoke('foundry:launchSetPrices', opts),
  launchSetPhase: (opts: { phase: 'closed' | 'allowlist' | 'public'; confirm?: string }) => ipcRenderer.invoke('foundry:launchSetPhase', opts),
};

contextBridge.exposeInMainWorld('foundry', foundryApi);
