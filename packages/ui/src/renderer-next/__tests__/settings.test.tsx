import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ToastProvider } from '../components';
import { ThemeProvider } from '../theme/ThemeProvider';

const baseConfig = {
  name: 'S',
  editionSize: 5,
  image: { width: 8, height: 8 },
  layers: [{ name: 'A', path: 'layers/a' }],
  rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
  export: { outDir: 'build', imageFormat: 'png' },
  storage: { provider: 'local', local: {} },
  chain: { target: 'solana', solana: { cluster: 'devnet' } },
};

function installBridge() {
  const writeConfig = vi.fn(async (_cfg: unknown) => ({ ok: true }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: structuredClone(baseConfig) }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig,
    readFile: async () => ({ ok: false }),
    listImages: async () => ({ ok: true, count: 0 }),
    previewLive: async () => ({ ok: true, images: [] }),
    buildWithProgress: async () => ({ ok: true }),
    pauseBuild: async () => ({ ok: true }),
    resumeBuild: async () => ({ ok: true }),
    stopBuild: async () => ({ ok: true }),
    onBuildProgress: () => undefined,
    auditAssets: async () => ({ ok: true, json: {} }),
    auditOutputs: async () => ({ ok: true, json: {} }),
    run: async () => ({ ok: true }),
    openInExplorer: async () => ({ ok: true }),
    openExternal: async () => ({ ok: true }),
  };
  return { writeConfig };
}

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

function mount() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <ProjectProvider>
          <SettingsScreen />
        </ProjectProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('SettingsScreen', () => {
  it('edits a storage field and saves, preserving the rest of the config', async () => {
    const { writeConfig } = installBridge();
    const { findByLabelText, getByRole } = mount();
    const outDir = (await findByLabelText('Out dir')) as HTMLInputElement;
    fireEvent.change(outDir, { target: { value: 'cids' } });
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalledTimes(1));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls[0]![0] as any;
    expect(saved.storage.local.outDir).toBe('cids');
    expect(saved.storage.provider).toBe('local');
    expect(saved.layers).toHaveLength(1); // untouched
    expect(saved.chain.target).toBe('solana');
  });
});
