import * as electron from 'electron';

const MAX_EXTERNAL_URL_LENGTH = 2048;
const UNAUTHORIZED_IPC_ERROR = 'Unauthorized IPC sender';

type IpcSenderLike = {
  senderFrame?: { url?: string } | null;
  sender?: { mainFrame?: unknown } | null;
};

export type TrustedIpcHandle = (
  channel: string,
  listener: (event: electron.IpcMainInvokeEvent, ...args: any[]) => unknown,
) => void;

function containsAsciiControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_EXTERNAL_URL_LENGTH) return false;
  if (value !== value.trim() || containsAsciiControl(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function normalizeDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function isTrustedIpcSender(event: IpcSenderLike, trustedRendererUrl: string): boolean {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender?.mainFrame || typeof frame.url !== 'string') return false;
  const actual = normalizeDocumentUrl(frame.url);
  const expected = normalizeDocumentUrl(trustedRendererUrl);
  return actual !== null && expected !== null && actual === expected;
}

export function createTrustedIpcHandle(trustedRendererUrl: string): TrustedIpcHandle {
  if (normalizeDocumentUrl(trustedRendererUrl) === null) throw new Error('Invalid trusted renderer URL');
  return (channel, listener) => {
    electron.ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedIpcSender(event, trustedRendererUrl)) return { ok: false, error: UNAUTHORIZED_IPC_ERROR };
      return listener(event, ...args);
    });
  };
}

export function hardenPrimaryWindowNavigation(webContents: electron.WebContents): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event) => event.preventDefault());
}
