// Engine host — runs inside an Electron `utilityProcess` (forked by engine-client.ts).
//
// All CPU-heavy engine work (trait generation, sharp rendering, the CPU compositor,
// base64 encoding) executes here, off the main/browser process, so the window's message
// loop is never blocked. It speaks the request/response/progress protocol defined in
// engine-client.ts over `process.parentPort` (injected by Electron into the child), so it
// imports no `electron` API itself.

import * as engine from './engine-service.js';
import type { EngineReply } from './engine-client.js';

interface IncomingMessage {
  type: 'call' | 'control';
  id: number;
  method?: string;
  args?: Record<string, unknown>;
  action?: 'pause' | 'resume' | 'stop';
}

interface ParentPort {
  on(event: 'message', listener: (e: { data: IncomingMessage }) => void): void;
  postMessage(message: EngineReply): void;
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

// Cooperative pause/stop flags for in-flight long-running calls, keyed by request id.
const controllers = new Map<number, { paused: boolean; stopped: boolean }>();

function post(msg: EngineReply): void {
  parentPort?.postMessage(msg);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

async function dispatch(id: number, method: string, args: Record<string, unknown>): Promise<unknown> {
  const projectDir = String(args.projectDir ?? '');
  switch (method) {
    case 'renderLivePreviews':
      return engine.renderLivePreviews(
        projectDir,
        args.configLike as Record<string, unknown> | undefined,
        Number(args.count ?? 4),
        str(args.seed) ?? 'ui-live',
      );

    case 'renderEffectsPreview':
      return engine.renderEffectsPreview(projectDir, args.configLike as Record<string, unknown> | undefined);

    case 'buildCollection':
      return engine.buildCollection({
        projectDir,
        count: Number(args.count ?? 0),
        seed: str(args.seed),
        onProgress: (p) => post({ type: 'progress', id, payload: p }),
      });

    case 'renderPreviewsToDisk': {
      const ctrl = { paused: false, stopped: false };
      controllers.set(id, ctrl);
      try {
        return await engine.renderPreviewsToDisk({
          projectDir,
          count: Number(args.count ?? 0),
          seed: str(args.seed),
          onProgress: (current, total, message) => post({ type: 'progress', id, payload: { current, total, message } }),
          shouldStop: () => ctrl.stopped,
          waitWhilePaused: async () => {
            while (ctrl.paused && !ctrl.stopped) await new Promise((r) => setTimeout(r, 100));
          },
        });
      } finally {
        controllers.delete(id);
      }
    }

    default:
      throw new Error(`Unknown engine method: ${method}`);
  }
}

parentPort?.on('message', (e) => {
  const msg = e.data;
  if (msg.type === 'control') {
    const ctrl = controllers.get(msg.id);
    if (ctrl) {
      if (msg.action === 'pause') ctrl.paused = true;
      else if (msg.action === 'resume') ctrl.paused = false;
      else if (msg.action === 'stop') {
        ctrl.paused = false;
        ctrl.stopped = true;
      }
    }
    return;
  }
  void (async () => {
    try {
      const result = await dispatch(msg.id, msg.method ?? '', msg.args ?? {});
      post({ type: 'result', id: msg.id, ok: true, result });
    } catch (err) {
      post({ type: 'result', id: msg.id, ok: false, error: String((err as Error)?.message ?? err) });
    }
  })();
});
