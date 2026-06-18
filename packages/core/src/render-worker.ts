import { parentPort } from 'node:worker_threads';
import { renderEdition, type RenderEditionParams } from './render-edition.js';

// Worker entry for the parallel render pool. Each message is one edition's render
// params; it renders the image via the shared (deterministic) render path and posts the
// buffer back keyed by id. Generation happens on the main thread, so output is identical
// regardless of worker count or completion order.
interface JobMessage {
  id: number;
  params: RenderEditionParams;
}

if (parentPort) {
  const port = parentPort;
  port.on('message', (msg: JobMessage) => {
    void (async () => {
      try {
        const buf = await renderEdition(msg.params);
        port.postMessage({ id: msg.id, ok: true, buffer: buf });
      } catch (e) {
        port.postMessage({ id: msg.id, ok: false, error: String((e as Error)?.message ?? e) });
      }
    })();
  });
}
