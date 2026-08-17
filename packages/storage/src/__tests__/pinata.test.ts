import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PinataJwtProvider } from '../providers/pinata-jwt.js';

describe('PinataJwtProvider', () => {
  let root: string;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-pinata-'));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('uploads a file with JWT bearer auth and returns an ipfs uri', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ IpfsHash: 'bafyfile' }) });
    const f = path.join(root, 'x.png');
    await fs.writeFile(f, Buffer.from([9]));

    const p = new PinataJwtProvider('jwt-token');
    const ref = await p.uploadFile(f);

    expect(ref).toEqual({ uri: 'ipfs://bafyfile', type: 'image/png', cid: 'bafyfile' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('pinFileToIPFS');
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('uploads a directory and returns a directory base uri', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ IpfsHash: 'bafydir' }) });
    const dir = path.join(root, 'images');
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, '1.png'), Buffer.from([1]));
    await fs.writeFile(path.join(dir, '2.png'), Buffer.from([2]));

    const p = new PinataJwtProvider('jwt');
    const res = await p.uploadDirectory(dir);

    expect(res.baseUri).toBe('ipfs://bafydir/');
    expect(res.cid).toBe('bafydir');
    expect(res.files['1.png']).toBe('ipfs://bafydir/1.png');
    expect(res.files['2.png']).toBe('ipfs://bafydir/2.png');
  });

  it('retries and ultimately throws on persistent HTTP failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'err', text: async () => 'boom' });
    const f = path.join(root, 'x.png');
    await fs.writeFile(f, Buffer.from([9]));
    const p = new PinataJwtProvider('jwt');
    await expect(p.uploadFile(f)).rejects.toThrow(/Pinata upload failed/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 20000);
});
