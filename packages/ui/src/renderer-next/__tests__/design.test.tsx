import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { DesignScreen } from '../screens/DesignScreen';
import { ToastProvider } from '../components';

const baseConfig = {
  name: 'Specimens',
  symbol: 'SPC',
  editionSize: 100,
  image: { width: 1024, height: 1024, background: 'transparent' },
  layers: [
    { name: 'Background', path: 'layers/bg', rarity: 'filename', required: true },
    { name: 'Body', path: 'layers/body', rarity: 'filename', required: true },
  ],
  rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
  export: { outDir: 'build', imageFormat: 'png' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function installBridge(over: Record<string, any> = {}) {
  const writeConfig = vi.fn(async (_cfg: unknown) => ({ ok: true }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p/specimens' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: structuredClone(baseConfig) }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig,
    listImages: async () => ({ ok: true, count: 7 }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
    openExternal: async () => ({ ok: true }),
    ...over,
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
    <ToastProvider>
      <ProjectProvider>
        <DesignScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('DesignScreen', () => {
  it('loads config and shows basics + layers', async () => {
    installBridge();
    const { findByDisplayValue } = mount();
    expect(await findByDisplayValue('Specimens')).toBeTruthy();
    expect(await findByDisplayValue('Background')).toBeTruthy();
    expect(await findByDisplayValue('layers/body')).toBeTruthy();
  });

  it('edits a field and saves via the bridge, preserving untouched fields', async () => {
    const { writeConfig } = installBridge();
    const { findByDisplayValue, getByRole } = mount();
    const nameInput = (await findByDisplayValue('Specimens')) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Renamed' } });
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalledTimes(1));
    const saved = writeConfig.mock.calls[0]![0] as typeof baseConfig;
    expect(saved.name).toBe('Renamed');
    // Untouched fields round-trip losslessly.
    expect(saved.rarity).toEqual(baseConfig.rarity);
    expect(saved.layers).toHaveLength(2);
    expect(saved.export.outDir).toBe('build');
  });

  it('adds a layer', async () => {
    const { writeConfig } = installBridge();
    const { findByText, getByRole } = mount();
    await findByText('Layers');
    fireEvent.click(getByRole('button', { name: '+ Add layer' }));
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    const saved = writeConfig.mock.calls[0]![0] as typeof baseConfig;
    expect(saved.layers).toHaveLength(3);
  });
});
