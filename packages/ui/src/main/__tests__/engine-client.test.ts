import { describe, it, expect, vi } from 'vitest';
import { EngineClient, type ChildTransport, type EngineReply, type EngineRequest } from '../engine-client.js';

class FakeChild implements ChildTransport {
  sent: EngineRequest[] = [];
  private msgCb?: (m: EngineReply) => void;
  private exitCb?: (code: number) => void;
  postMessage(m: EngineRequest): void {
    this.sent.push(m);
  }
  on(event: 'message' | 'exit', cb: (arg: never) => void): void {
    if (event === 'message') this.msgCb = cb as unknown as (m: EngineReply) => void;
    else this.exitCb = cb as unknown as (code: number) => void;
  }
  reply(m: EngineReply): void {
    this.msgCb?.(m);
  }
  exit(code: number): void {
    this.exitCb?.(code);
  }
}

describe('EngineClient', () => {
  it('posts a call message and resolves on the matching result', async () => {
    const child = new FakeChild();
    const client = new EngineClient(() => child);
    const { id, result } = client.call<{ ok: number }>('renderLivePreviews', { projectDir: '/p' });

    expect(id).toBe(1);
    expect(child.sent[0]).toEqual({ type: 'call', id: 1, method: 'renderLivePreviews', args: { projectDir: '/p' } });

    child.reply({ type: 'result', id: 1, ok: true, result: { ok: 42 } });
    await expect(result).resolves.toEqual({ ok: 42 });
  });

  it('routes progress to onProgress without resolving, then resolves on result', async () => {
    const child = new FakeChild();
    const client = new EngineClient(() => child);
    const onProgress = vi.fn();
    const { result } = client.call('renderPreviewsToDisk', { projectDir: '/p', count: 3 }, { onProgress });

    child.reply({ type: 'progress', id: 1, payload: { current: 1, total: 3 } });
    child.reply({ type: 'progress', id: 1, payload: { current: 2, total: 3 } });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith({ current: 2, total: 3 });

    child.reply({ type: 'result', id: 1, ok: true, result: { written: 3 } });
    await expect(result).resolves.toEqual({ written: 3 });
  });

  it('rejects when the host reports an error', async () => {
    const child = new FakeChild();
    const client = new EngineClient(() => child);
    const { result } = client.call('renderEffectsPreview', { projectDir: '/p' });
    child.reply({ type: 'result', id: 1, ok: false, error: 'No assets found to preview' });
    await expect(result).rejects.toThrow('No assets found to preview');
  });

  it('forwards control signals targeting an in-flight call', () => {
    const child = new FakeChild();
    const client = new EngineClient(() => child);
    const { id } = client.call('renderPreviewsToDisk', { projectDir: '/p' });
    client.control(id, 'pause');
    client.control(id, 'stop');
    expect(child.sent).toContainEqual({ type: 'control', id, action: 'pause' });
    expect(child.sent).toContainEqual({ type: 'control', id, action: 'stop' });
  });

  it('spawns the child once and reuses it across calls', () => {
    const factory = vi.fn(() => new FakeChild());
    const client = new EngineClient(factory);
    client.call('a', {});
    client.call('b', {});
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('rejects all pending calls when the engine process exits', async () => {
    const child = new FakeChild();
    const client = new EngineClient(() => child);
    const { result } = client.call('buildCollection', { projectDir: '/p' });
    child.exit(1);
    await expect(result).rejects.toThrow('engine process exited (code 1)');
  });
});
