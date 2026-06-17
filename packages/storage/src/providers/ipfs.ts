// Deprecated: nft.storage's classic API is sunset and the legacy @pinata/sdk has been
// removed. This file remains only to preserve the export surface for back-compat. Use the
// `pinata` (JWT) or `local` StorageProvider instead.

export interface IpfsConfig {
  pinataKey?: string;
  pinataSecret?: string;
  nftStorageKey?: string;
}

/** @deprecated nft.storage classic API is sunset. Use the 'pinata' or 'local' provider. */
export async function uploadViaNftStorage(
  _filePath: string,
  _key: string,
): Promise<{ uri: string; type: string }> {
  throw new Error('uploadViaNftStorage is deprecated. Use the "pinata" (JWT) or "local" storage provider.');
}

/** @deprecated Legacy Pinata key/secret SDK removed. Use the JWT-based 'pinata' provider. */
export async function uploadViaPinata(
  _filePath: string,
  _key: string,
  _secret: string,
): Promise<{ uri: string; type: string }> {
  throw new Error(
    'uploadViaPinata (api key/secret) is deprecated. Use createProvider({ provider: "pinata", pinata: { jwt } }).',
  );
}
