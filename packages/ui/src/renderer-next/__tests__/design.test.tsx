import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectProvider, useProject } from '../state/project';
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

function ProjectSwitch() {
  const { openDir } = useProject();
  return (
    <button onClick={() => void openDir({ dir: '/p/two', name: 'Two' })}>Switch project</button>
  );
}

function mountWithProjectSwitch() {
  return render(
    <ToastProvider>
      <ProjectProvider>
        <DesignScreen />
        <ProjectSwitch />
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

  it('uses core-catalog file types for parent layer counts and rarity bars', async () => {
    const listImages = vi.fn(async () => ({ ok: true, count: 99 }));
    installBridge({
      listImages,
      listDir: async (path: string) => ({
        ok: true,
        items: path === 'layers/bg' ? ['Gold#1.png', 'Ignored#9.jpg'] : [],
      }),
      readFileBase64: async () => ({ ok: true, base64: 'gold', mime: 'image/png' }),
    });
    const { findByDisplayValue, findByRole } = mount();
    const path = await findByDisplayValue('layers/bg');
    await waitFor(() =>
      expect(path.closest('.layer-row')?.querySelector('.mono.muted')?.textContent).toBe('1'),
    );
    expect(await findByRole('img', { name: 'Rarity distribution — Gold 100.0%' })).toBeTruthy();
    expect(listImages).not.toHaveBeenCalled();
  });

  it('wires the existing project trait catalog into transform suggestions without another scan', async () => {
    const listDir = vi.fn(async (path: string) => ({
      ok: true,
      items: path === 'layers/bg' ? ['Aurora#2.png'] : ['Robot#3.png'],
    }));
    installBridge({
      listDir,
      readFileBase64: async () => ({ ok: true, base64: 'trait', mime: 'image/png' }),
    });
    const { findByRole, findByLabelText, getByRole, queryByRole } = mount();
    await findByLabelText('Layer 1 name');
    await waitFor(() => expect(listDir).toHaveBeenCalledWith('layers/bg'));
    fireEvent.click(await findByRole('tab', { name: 'Rules' }));
    fireEvent.click(getByRole('button', { name: '+ Add transform' }));
    const condition = await findByLabelText('Transform 1 when traits match any of');
    fireEvent.focus(condition);
    expect(getByRole('option', { name: 'Background:Aurora' })).toBeTruthy();
    expect(getByRole('option', { name: 'Body:Robot' })).toBeTruthy();
    const values = getByRole('combobox', { name: 'Transform 1 values' });
    fireEvent.focus(values);
    expect(getByRole('option', { name: 'Aurora' })).toBeTruthy();
    expect(queryByRole('option', { name: 'Robot' })).toBeNull();
    expect(listDir).toHaveBeenCalledTimes(4);
  });

  it('refreshes the scoped transform catalog after a trait-file rename', async () => {
    let backgroundFiles = ['Aurora#1.png'];
    const renameFileExact = vi.fn(async () => {
      backgroundFiles = ['Aurora#2.png'];
      return { ok: true, renamed: 1 };
    });
    installBridge({
      listDir: async (path: string) => ({ ok: true, items: path === 'layers/bg' ? backgroundFiles : [] }),
      renameFileExact,
      readFileBase64: async () => ({ ok: true, base64: 'trait', mime: 'image/png' }),
    });
    const { findByLabelText, findByRole, getByLabelText, getByRole, queryByRole } = mount();
    await findByLabelText('Layer 1 name');
    fireEvent.click(getByRole('button', { name: 'Browse layer 1 traits' }));
    fireEvent.click(await findByRole('button', { name: 'Edit rarity for Aurora#1.png' }));
    fireEvent.change(getByLabelText('Rarity weight for Aurora#1.png'), { target: { value: '2' } });
    fireEvent.click(getByRole('button', { name: 'Apply rarity for Aurora#1.png' }));
    await waitFor(() => expect(renameFileExact).toHaveBeenCalledWith('layers/bg/Aurora#1.png', 'layers/bg/Aurora#2.png'));
    fireEvent.click(await findByRole('tab', { name: 'Rules' }));
    fireEvent.click(getByRole('button', { name: '+ Add transform' }));
    const previewAsset = await findByLabelText('Preview sample asset');
    expect(previewAsset.querySelector('option')?.textContent).toContain('Aurora#2.png');
    expect(queryByRole('option', { name: 'Aurora#1.png' })).toBeNull();
  });

  it('keeps a new project thumbnail when both projects use the same layer paths', async () => {
    let activeProject = '/p/one';
    let resolveOldRead: (value: { ok: boolean; base64?: string; mime?: string }) => void = () =>
      undefined;
    const oldRead = new Promise<{ ok: boolean; base64?: string; mime?: string }>((resolve) => {
      resolveOldRead = resolve;
    });
    const readFileBase64 = vi.fn((path: string) =>
      path.includes('Old#1.png')
        ? oldRead
        : Promise.resolve({ ok: true, base64: 'new-project', mime: 'image/png' }),
    );
    installBridge({
      getProjectDir: async () => ({ ok: true, projectDir: '/p/one' }),
      setProjectDir: async (dir: string) => {
        activeProject = dir;
        return { ok: true };
      },
      readConfig: async () => ({
        ok: true,
        json: { ...structuredClone(baseConfig), name: activeProject === '/p/one' ? 'One' : 'Two' },
      }),
      listDir: async (path: string) => ({
        ok: true,
        items: path === 'layers/bg' ? [activeProject === '/p/one' ? 'Old#1.png' : 'New#1.png'] : [],
      }),
      readFileBase64,
    });
    const { findByLabelText, getByRole } = mountWithProjectSwitch();
    await findByLabelText('Layer 1 name');
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledWith('layers/bg/Old#1.png'));
    fireEvent.click(getByRole('button', { name: 'Switch project' }));
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledWith('layers/bg/New#1.png'));
    await waitFor(() =>
      expect(document.querySelector('.layer-thumb')?.getAttribute('src')).toContain('new-project'),
    );
    resolveOldRead({ ok: true, base64: 'old-project', mime: 'image/png' });
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('.layer-thumb')?.getAttribute('src')).toContain('new-project');
  });

  it('does not show old project trait suggestions while a same-path project catalog reloads', async () => {
    let activeProject = '/p/one';
    let resolveNewListing: (value: { ok: boolean; items: string[] }) => void = () => undefined;
    const newListing = new Promise<{ ok: boolean; items: string[] }>((resolve) => {
      resolveNewListing = resolve;
    });
    const listDir = vi.fn((path: string) => {
      if (path !== 'layers/bg') return Promise.resolve({ ok: true, items: [] });
      return activeProject === '/p/one'
        ? Promise.resolve({ ok: true, items: ['OldProject#1.png'] })
        : newListing;
    });
    installBridge({
      getProjectDir: async () => ({ ok: true, projectDir: '/p/one' }),
      setProjectDir: async (dir: string) => {
        activeProject = dir;
        return { ok: true };
      },
      readConfig: async () => ({ ok: true, json: { ...structuredClone(baseConfig), name: activeProject } }),
      listDir,
      readFileBase64: async () => ({ ok: true, base64: 'trait', mime: 'image/png' }),
    });
    const { findByLabelText, findByRole, getByRole, queryByRole } = mountWithProjectSwitch();
    await findByLabelText('Layer 1 name');
    await waitFor(() => expect(listDir).toHaveBeenCalledWith('layers/bg'));
    fireEvent.click(await findByRole('tab', { name: 'Rules' }));
    fireEvent.click(getByRole('button', { name: '+ Add transform' }));
    const condition = await findByLabelText('Transform 1 when traits match any of');
    fireEvent.focus(condition);
    expect(getByRole('option', { name: 'Background:OldProject' })).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Switch project' }));
    await waitFor(() => expect(listDir.mock.calls.length).toBeGreaterThan(4));
    expect(queryByRole('option', { name: 'Background:OldProject' })).toBeNull();

    resolveNewListing({ ok: true, items: ['NewProject#1.png'] });
    fireEvent.click(getByRole('button', { name: '+ Add transform' }));
    fireEvent.focus(await findByLabelText('Transform 1 when traits match any of'));
    expect(await findByRole('option', { name: 'Background:NewProject' })).toBeTruthy();
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

  it('edits the schema-backed preview output folder and does not expose unused seed jitter', async () => {
    const { writeConfig } = installBridge();
    const { findByRole, findByLabelText, getByRole, queryByLabelText } = mount();
    fireEvent.click(await findByRole('tab', { name: 'Basics' }));
    fireEvent.change(await findByLabelText('Preview output folder'), {
      target: { value: 'review/previews' },
    });
    expect(queryByLabelText('Generation seed jitter')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Save config' }));
    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = writeConfig.mock.calls.at(-1)![0] as any;
    expect(saved.export.previewOutDir).toBe('review/previews');
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
    fireEvent.click(await findByLabelText('Glow'));
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
    fireEvent.click(await findByLabelText('Recolor (duotone)'));
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
    fireEvent.change(ta, {
      target: { value: '{"maxOccurrences":[{"trait":"Body:Red","max":3}]}' },
    });
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
