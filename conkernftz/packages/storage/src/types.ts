export interface UploadedFileRef {
  /** Content-addressed URI for the uploaded file (e.g. ar://… or ipfs://…). */
  uri: string;
  /** MIME type of the uploaded file. */
  type: string;
}

export interface DirUploadResult {
  /** Base CID (IPFS) or identifier for the uploaded directory. */
  cid: string;
  /**
   * Base URI for the directory, e.g. `ipfs://<cid>/`. Append a filename to address
   * an individual file. Suitable for use as an ERC-721 `baseURI`.
   */
  uri: string;
}

export interface StorageProvider {
  readonly id: 'irys' | 'pinata' | 'local';
  /** Upload a single file, returning a content-addressed URI. */
  uploadFile(filePath: string): Promise<UploadedFileRef>;
  /**
   * Upload an entire directory as a single unit (e.g. an IPFS directory), returning a
   * base URI suitable for an ERC-721 `baseURI`. Not all providers support this.
   */
  uploadDir?(dirPath: string): Promise<DirUploadResult>;
}
