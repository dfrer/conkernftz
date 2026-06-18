import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { PublishScreen } from '../screens/PublishScreen';
import { ToastProvider } from '../components';

const cfg = {
  name: 'P',
  editionSize: 2,
  image: { width: 8, height: 8 },
  layers: [],
  rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
  export: { outDir: 'build', imageFormat: 'png' },
  storage: { provider: 'local' },
  chain: { target: 'solana', solana: { cluster: 'devnet' } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function installBridge(over: Record<string, any> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: cfg }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig: async () => ({ ok: true }),
    readFile: async () => ({ ok: false }),
    listImages: async () => ({ ok: true, count: 0 }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
    buildWithProgress: async () => ({ ok: true }),
    pauseBuild: async () => ({ ok: true }),
    resumeBuild: async () => ({ ok: true }),
    stopBuild: async () => ({ ok: true }),
    onBuildProgress: () => undefined,
    auditAssets: async () => ({ ok: true, json: {} }),
    auditOutputs: async () => ({ ok: true, json: {} }),
    run: vi.fn(async () => ({ ok: true, stdout: 'ok' })),
    openExternal: async () => ({ ok: true }),
    ...over,
  };
}

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

function mount() {
  return render(
    <ToastProvider>
      <ProjectProvider>
        <PublishScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('PublishScreen', () => {
  it('uploads with a real provider and shows the manifest', async () => {
    const run = vi.fn(async (_args: string[]) => ({ ok: true, stdout: 'uploaded' }));
    installBridge({
      run,
      readFile: async (rel: string) =>
        rel.endsWith('.upload-manifest.json')
          ? { ok: true, content: JSON.stringify({ provider: 'local', mode: 'auto', baseUri: 'file:///proj/build/json/', files: [1, 2] }) }
          : { ok: false },
    });
    const { findByRole, findByText } = mount();
    fireEvent.click(await findByRole('button', { name: 'Upload assets' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(['upload', '--provider', 'local', '--mode', 'auto']));
    expect(await findByText(/file:\/\/\/proj\/build\/json\//)).toBeTruthy();
  });

  it('mints via the CLI bridge (Solana direct)', async () => {
    const run = vi.fn(async (_args: string[]) => ({ ok: true, stdout: 'minted' }));
    installBridge({ run });
    const { findByRole } = mount();
    fireEvent.click(await findByRole('button', { name: 'Mint (direct)' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(['mint', '--from', '1', '--count', '1']));
  });
});
