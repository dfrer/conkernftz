import { Worker } from 'node:worker_threads';
import os from 'node:os';
import type { RenderEditionParams } from './render-edition.js';

/**
 * Resolve how many worker threads to use. Returns 1 (in-process) unless `requested` is
 * > 1, capped by the job count and the CPU count.
 */
export function resolveWorkerCount(requested: number | undefined, jobCount: number): number {
  const cpus = Math.max(1, os.cpus()?.length ?? 1);
  const want = typeof requested === 'number' && Number.isFinite(requested) && requested > 1 ? Math.floor(requested) : 1;
  if (want <= 1 || jobCount <= 1) return 1;
  return Math.max(1, Math.min(want, jobCount, cpus));
}

export interface RenderJob {
  id: number;
  params: RenderEditionParams;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  buffer?: Uint8Array;
  error?: string;
}

/**
 * Render a set of edition images across `workerCount` worker threads. Returns a map of
 * job id → encoded image buffer. Deterministic: each job is rendered by the same pure
 * render path, so results don't depend on which worker ran them.
 */
export async function renderInPool(jobs: RenderJob[], workerCount: number): Promise<Map<number, Buffer>> {
  const results = new Map<number, Buffer>();
  if (jobs.length === 0) return results;
  const n = Math.max(1, Math.min(workerCount, jobs.length));
  const workerUrl = new URL('./render-worker.js', import.meta.url);
  const queue = [...jobs];

  return await new Promise<Map<number, Buffer>>((resolve, reject) => {
    const workers: Worker[] = [];
    let completed = 0;
    let failure: Error | null = null;
    let settled = false;

    const cleanup = (): void => {
      for (const w of workers) void w.terminate();
    };
    const settle = (): void => {
      if (settled || completed < jobs.length) return;
      settled = true;
      cleanup();
      if (failure) reject(failure);
      else resolve(results);
    };
    const dispatch = (w: Worker): void => {
      const job = queue.shift();
      if (job) w.postMessage({ id: job.id, params: job.params });
    };

    for (let i = 0; i < n; i++) {
      const w = new Worker(workerUrl);
      workers.push(w);
      w.on('message', (msg: WorkerReply) => {
        if (msg.ok && msg.buffer) results.set(msg.id, Buffer.from(msg.buffer));
        else failure = failure ?? new Error(`render worker failed (edition ${msg.id}): ${msg.error ?? 'unknown'}`);
        completed++;
        if (completed < jobs.length) dispatch(w);
        else settle();
      });
      w.on('error', (err) => {
        failure = failure ?? err;
        completed++;
        if (completed >= jobs.length) settle();
      });
      dispatch(w);
    }
  });
}
