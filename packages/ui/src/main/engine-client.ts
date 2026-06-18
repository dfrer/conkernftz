// Engine RPC client (main process side).
//
// The engine (generation + sharp rendering + base64 encoding) is CPU-heavy and used to
// run inline on the Electron *main/browser* process — which owns the OS window's message
// loop. Long synchronous stretches there make the window go "Not Responding". This client
// drives the engine in a separate Electron `utilityProcess` (see engine-host.ts) over a
// tiny request/response/progress protocol, so the main process — and the window — never
// blocks.
//
// The transport is injected (a factory returning a UtilityProcess-shaped object) so the
// framing logic is unit-testable without spawning a real Electron process.

import path from 'node:path';
import * as electron from 'electron';

export interface EngineRequest {
  type: 'call' | 'control';
  id: number;
  method?: string;
  args?: unknown;
  action?: 'pause' | 'resume' | 'stop';
}

export interface EngineReply {
  type: 'progress' | 'result';
  id: number;
  payload?: unknown;
  ok?: boolean;
  result?: unknown;
  error?: string;
}

/** Minimal shape shared by Electron's UtilityProcess and the test fake. */
export interface ChildTransport {
  postMessage(message: EngineRequest): void;
  on(event: 'message', listener: (message: EngineReply) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
}

export interface EngineCallHandlers {
  onProgress?: (payload: unknown) => void;
}

export interface EngineCall<T> {
  id: number;
  result: Promise<T>;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  onProgress?: (payload: unknown) => void;
}

export class EngineClient {
  private child: ChildTransport | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor(private readonly factory: () => ChildTransport) {}

  private ensureChild(): ChildTransport {
    if (this.child) return this.child;
    const child = this.factory();
    child.on('message', (msg) => this.onMessage(msg));
    child.on('exit', (code) => this.onExit(code));
    this.child = child;
    return child;
  }

  private onMessage(msg: EngineReply): void {
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.payload);
      return;
    }
    this.pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error ?? 'engine call failed'));
  }

  private onExit(code: number): void {
    const err = new Error(`engine process exited (code ${code})`);
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    this.child = null;
  }

  /** Invoke an engine method. Returns the request id (for control) and a result promise. */
  call<T = unknown>(method: string, args: unknown, handlers?: EngineCallHandlers): EngineCall<T> {
    const child = this.ensureChild();
    const id = ++this.seq;
    const result = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress: handlers?.onProgress });
    });
    child.postMessage({ type: 'call', id, method, args });
    return { id, result };
  }

  /** Send a cooperative control signal (pause/resume/stop) for an in-flight call. */
  control(id: number, action: 'pause' | 'resume' | 'stop'): void {
    if (this.child) this.child.postMessage({ type: 'control', id, action });
  }
}

// --- Real Electron transport (lazy: electron is required only when first used) ---

function forkHost(): ChildTransport {
  const hostPath = path.join(__dirname, 'engine-host.js');
  const child = electron.utilityProcess.fork(hostPath, [], { serviceName: 'conkernftz-engine' });
  return child as unknown as ChildTransport;
}

let _client: EngineClient | null = null;

/** The shared engine client, backed by a real Electron utilityProcess. */
export function getEngineClient(): EngineClient {
  if (!_client) _client = new EngineClient(forkHost);
  return _client;
}
