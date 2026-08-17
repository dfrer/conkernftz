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
    listDir: async () => ({ ok: true, items: [] }),
    renameFiles: async () => ({ ok: true, renamed: 0 }),
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
    const { findByDisplayValue, findByLabelText, getByRole } = mount();
    // Layers is the default tab.
    expect(await findByLabelText('Layer 1 name')).toBeTruthy();
    expect(await findByDisplayValue('layers/body')).toBeTruthy();
    // Basics lives behind its own tab.
    fireEvent.click(getByRole('tab', { name: 'Basics' }));
    expect(await findByDisplayValue('Specimens')).toBeTruthy();
  });

  it('edits a field and saves via the bridge, preserving untouched fields', async () => {
    const { writeConfig } = installBridge();
    const { findByDisplayValue, findByRole, getByRole } = mount();
    fireEvent.click(await findByRole('tab', { name: 'Basics' }));
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
    const { findByLabelText, getByRole } = mount();
    await findByLabelText('Layer 1 name');
    fireEvent.click(getByRole('button', { name: '+ Add layer' }));
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    const saved = writeConfig.mock.calls[0]![0] as typeof baseConfig;
    expect(saved.layers).toHaveLength(3);
  });

  it('edits a layer effect (glow) and saves losslessly', async () => {
    const { writeConfig } = installBridge();
    const { findByLabelText, getByRole, getByLabelText } = mount();
    await findByLabelText('Layer 1 name');
    fireEvent.click(getByRole('button', { name: 'Edit layer 1 effects' }));
    fireEvent.click(getByLabelText('Glow'));
    fireEvent.change(getByLabelText('Color'), { target: { value: '#00eaff' } });
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls.at(-1)![0] as any;
    expect(saved.layers[0].effects.glow.color).toBe('#00eaff');
    expect(saved.rarity).toEqual(baseConfig.rarity); // untouched fields preserved
  });

  it('edits a layer recolor effect and saves losslessly', async () => {
    const { writeConfig } = installBridge();
    const { findByLabelText, getByRole, getByLabelText } = mount();
    await findByLabelText('Layer 1 name');
    fireEvent.click(getByRole('button', { name: 'Edit layer 1 effects' }));
    fireEvent.click(getByLabelText('Recolor (duotone)'));
    fireEvent.change(getByLabelText('Preset'), { target: { value: 'sepia' } });
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls.at(-1)![0] as any;
    expect(saved.layers[0].effects.recolor.preset).toBe('sepia');
    expect(saved.rarity).toEqual(baseConfig.rarity); // untouched fields preserved
  });

  it('applies rules JSON and saves losslessly', async () => {
    const { writeConfig } = installBridge();
    const { findByLabelText, findByRole, getByRole } = mount();
    fireEvent.click(await findByRole('tab', { name: 'Rules' }));
    const ta = (await findByLabelText('Rules JSON')) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"maxOccurrences":[{"trait":"Body:Red","max":3}]}' } });
    fireEvent.click(getByRole('button', { name: 'Apply JSON' }));
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls.at(-1)![0] as any;
    expect(saved.rules.maxOccurrences[0].max).toBe(3);
    expect(saved.layers).toHaveLength(2); // untouched fields preserved
  });

  it('adds a per-asset override with a glow effect, losslessly', async () => {
    const { writeConfig } = installBridge();
    const { findByLabelText, findByRole, getByRole, getByLabelText, getAllByLabelText } = mount();
    await findByLabelText('Layer 1 name');
    fireEvent.click(getByRole('button', { name: 'Edit layer 1 effects' }));
    fireEvent.click(await findByRole('button', { name: '+ Add override' }));
    fireEvent.change(getByLabelText('Override match 1'), { target: { value: 'Gold' } });
    // Two "Glow" toggles now exist (layer + override); index 1 is the override's.
    fireEvent.click(getAllByLabelText('Glow')[1]!);
    fireEvent.change(getByLabelText('Color'), { target: { value: '#ffcc00' } });
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls.at(-1)![0] as any;
    expect(saved.layers[0].overrides[0]).toMatchObject({ target: 'value', match: 'Gold' });
    expect(saved.layers[0].overrides[0].effects.glow.color).toBe('#ffcc00');
    expect(saved.rarity).toEqual(baseConfig.rarity);
  });
});
