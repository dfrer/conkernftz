import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { handlers, ipcMain } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = {
    handle: vi.fn((channel: string, handler: any) => {
      handlers[channel] = handler;
    }),
  };
  return { handlers, ipcMain };
});

vi.mock('electron', () => ({ ipcMain }));

import { createTrustedIpcHandle } from '../ipc-security.js';

const TRUSTED_RENDERER_URL = 'file:///opt/conkernftz/dist/renderer-next/index.html';

function trustedEvent(url = TRUSTED_RENDERER_URL) {
  const mainFrame = { url };
  return { senderFrame: mainFrame, sender: { mainFrame } };
}

function productionMainSources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionMainSources(target);
    return entry.isFile() && entry.name.endsWith('.ts') ? [target] : [];
  });
}

describe('ipc-security', () => {
  it('forwards arguments from the exact trusted main frame', async () => {
    const listener = vi.fn(async (_event, value: string) => ({ ok: true, value }));
    createTrustedIpcHandle(TRUSTED_RENDERER_URL)('foundry:test', listener);
    const event = trustedEvent();

    await expect(handlers['foundry:test'](event, 'allowed')).resolves.toEqual({
      ok: true,
      value: 'allowed',
    });
    expect(listener).toHaveBeenCalledWith(event, 'allowed');
  });

  it('rejects a same-document subframe before invoking the listener', async () => {
    const listener = vi.fn();
    createTrustedIpcHandle(TRUSTED_RENDERER_URL)('foundry:test', listener);
    const mainFrame = { url: TRUSTED_RENDERER_URL };
    const subframe = { url: TRUSTED_RENDERER_URL };

    expect(handlers['foundry:test']({ senderFrame: subframe, sender: { mainFrame } })).toEqual({
      ok: false,
      error: 'Unauthorized IPC sender',
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects an unexpected renderer document before invoking the listener', async () => {
    const listener = vi.fn();
    createTrustedIpcHandle(TRUSTED_RENDERER_URL)('foundry:test', listener);

    expect(handlers['foundry:test'](trustedEvent('file:///tmp/attacker.html'))).toEqual({
      ok: false,
      error: 'Unauthorized IPC sender',
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the complete privileged channel inventory behind the shared handle', () => {
    const mainDir = path.resolve(process.cwd(), 'src', 'main');
    const files = productionMainSources(mainDir);
    const directHandleOwners: string[] = [];
    const channels: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (/ipcMain\.handle/.test(source))
        directHandleOwners.push(path.relative(mainDir, file).replaceAll('\\', '/'));
      channels.push(
        ...Array.from(
          source.matchAll(/\bhandle\(\s*['"](foundry:[^'"]+)['"]/g),
          (match) => match[1]!,
        ),
      );
    }

    expect(directHandleOwners).toEqual(['ipc-security.ts']);
    expect(channels).toHaveLength(57);
    expect(new Set(channels).size).toBe(57);
  });

  it('wires every privileged initializer to the trusted handle in production bootstrap', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src', 'main.ts'), 'utf8');
    expect(source).toContain(
      'const handleTrustedIpc = createTrustedIpcHandle(trustedRendererUrl);',
    );
    for (const initializer of [
      'initProjectIpc',
      'initStorageIpc',
      'initPacksIpc',
      'initCliRunner',
      'initLaunchRunner',
      'initSolanaLaunchRunner',
    ]) {
      expect(source).toContain(`${initializer}(handleTrustedIpc);`);
    }
  });
});
