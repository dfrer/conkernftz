import { describe, it, expect } from 'vitest';
import { createLocalProvider } from '../providers/local.js';

describe('local storage provider', () => {
  it('returns a file:// URI with a detected mime type by default', async () => {
    const provider = createLocalProvider({});
    const res = await provider.uploadFile('/tmp/some/1.png');
    expect(res.uri.startsWith('file://')).toBe(true);
    expect(res.uri.endsWith('1.png')).toBe(true);
    expect(res.type).toBe('image/png');
  });

  it('prepends a configured baseUri to the file name', async () => {
    const provider = createLocalProvider({ baseUri: 'ipfs://CID' });
    const res = await provider.uploadFile('/a/b/1.json');
    expect(res.uri).toBe('ipfs://CID/1.json');
    expect(res.type).toBe('application/json');
  });

  it('uploadDir returns a trailing-slash base URI suitable for an ERC-721 baseURI', async () => {
    const provider = createLocalProvider({ baseUri: 'ipfs://CID' });
    const res = await provider.uploadDir!('/some/dir');
    expect(res.uri).toBe('ipfs://CID/');
    expect(res.cid).toBe('local');
  });
});
