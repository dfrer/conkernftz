// Deprecated: Bundlr is sunset and its SDK has been removed. This file remains only to
// preserve the export surface for back-compat. Use the `irys` StorageProvider instead
// (createProvider({ provider: 'irys', ... })).

export interface BundlrConfig {
  bundlrNode: string;
  currency: string;
  keyPath: string;
}

/** @deprecated Use createProvider({ provider: 'irys', irys: { token, keyPath } }). */
export async function uploadFileViaBundlr(
  _filePath: string,
  _cfg: BundlrConfig,
): Promise<{ uri: string; type: string }> {
  throw new Error(
    'uploadFileViaBundlr is deprecated (Bundlr SDK removed). Use the "irys" storage provider instead.',
  );
}
