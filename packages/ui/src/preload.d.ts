import type { FoundryApi } from './shared/ipc.js';

export {}; // module

declare global {
  interface Window {
    foundry: FoundryApi;
  }
}
