import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProjectProvider, useProject } from '../state/project';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ToastProvider } from '../components';

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

function mount(onOpened = vi.fn()) {
  const utils = render(
    <ToastProvider>
      <ProjectProvider>
        <ProjectsScreen onOpened={onOpened} />
        <ProjectSnapshot />
      </ProjectProvider>
    </ToastProvider>,
  );
  return { ...utils, onOpened };
}

function ProjectSnapshot() {
  const { project, config } = useProject();
  return <output data-testid="project-snapshot">{project?.dir ?? 'none'}|{config?.name ?? 'none'}</output>;
}

describe('ProjectsScreen — new project', () => {
  it('scaffolds a starter config + layer folders and opens the project', async () => {
    const writeConfig = vi.fn(async (_cfg: unknown) => ({ ok: true }));
    const ensureDirs = vi.fn(async (_paths: string[]) => ({ ok: true }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      chooseProjectDir: async () => ({ ok: true, projectDir: '/p/new' }),
      setProjectDir: async () => ({ ok: true }),
      readConfigAt: async () => ({ ok: false }), // empty folder — safe to scaffold
      writeConfig,
      ensureDirs,
      readConfig: async () => ({ ok: true, json: { name: 'Specimens', layers: [] } }),
    };

    const { getAllByRole, getByRole, getByLabelText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: 'New project' })[0]!);
    fireEvent.change(getByLabelText('Collection name'), { target: { value: 'Specimens' } });
    fireEvent.click(getByRole('button', { name: /Choose folder & create/ }));

    await waitFor(() => expect(writeConfig).toHaveBeenCalled());
    const saved = writeConfig.mock.calls[0]![0] as { name: string; symbol: string };
    expect(saved.name).toBe('Specimens');
    expect(saved.symbol).toBe('SPECIMEN');
    expect(ensureDirs).toHaveBeenCalledWith(['layers/Background', 'layers/Body', 'layers/Eyes', 'layers/Headwear']);
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
  });

  it('refuses to clobber a folder that already contains a project', async () => {
    const writeConfig = vi.fn(async () => ({ ok: true }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      chooseProjectDir: async () => ({ ok: true, projectDir: '/p/existing' }),
      setProjectDir: async () => ({ ok: true }),
      readConfigAt: async () => ({ ok: true, json: { name: 'Already Here' } }), // existing project
      writeConfig,
      ensureDirs: async () => ({ ok: true }),
      readConfig: async () => ({ ok: false }),
    };

    const { getAllByRole, getByRole, getByLabelText, findByText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: 'New project' })[0]!);
    fireEvent.change(getByLabelText('Collection name'), { target: { value: 'Specimens' } });
    fireEvent.click(getByRole('button', { name: /Choose folder & create/ }));

    expect(await findByText(/already contains a project/i)).toBeTruthy();
    expect(writeConfig).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
  });
});

describe('ProjectsScreen — layer-folder import', () => {
  it('loads an imported project, remembers it, and reports the imported layer count', async () => {
    const importedConfig = { name: 'Imported specimens', layers: [] };
    const importProjectFolder = vi.fn(async () => ({
      ok: true,
      projectDir: '/p/imported',
      config: importedConfig,
      created: true,
      layerCount: 3,
      layerNames: ['Background', 'Body', 'Eyes'],
    }));
    const readConfig = vi.fn(async () => ({ ok: true, json: { name: 'Original project', layers: [] } }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: true, projectDir: '/p/original' }),
      importProjectFolder,
      readConfig,
    };

    const { getAllByRole, findByText, getByTestId, onOpened } = mount();
    await waitFor(() => expect(getByTestId('project-snapshot').textContent).toBe('/p/original|Original project'));
    fireEvent.click(getAllByRole('button', { name: /Import layer folder/i })[0]!);

    await waitFor(() => expect(importProjectFolder).toHaveBeenCalledTimes(1));
    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(await findByText('Imported 3 layers')).toBeTruthy();
    await waitFor(() => expect(onOpened).toHaveBeenCalledTimes(1));
    expect(getByTestId('project-snapshot').textContent).toBe('/p/imported|Imported specimens');
    expect(JSON.parse(localStorage.getItem('cnftz:recents') ?? '[]')).toEqual([
      { dir: '/p/imported', name: 'Imported specimens' },
    ]);
  });

  it('opens a configured folder without presenting it as a newly imported config', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      importProjectFolder: async () => ({
        ok: true,
        projectDir: '/p/configured',
        config: { name: 'Already configured', layers: [] },
        created: false,
        layerCount: 2,
      }),
      readConfig: vi.fn(),
    };

    const { getAllByRole, findByText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: /Import layer folder/i })[0]!);

    expect(await findByText('Project loaded')).toBeTruthy();
    await waitFor(() => expect(onOpened).toHaveBeenCalledTimes(1));
  });

  it('surfaces a backend import failure and does not open a project', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      importProjectFolder: async () => ({ ok: false, error: 'No image layer folders were found' }),
    };

    const { getAllByRole, findAllByText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: /Import layer folder/i })[0]!);

    expect((await findAllByText('No image layer folders were found')).length).toBeGreaterThanOrEqual(1);
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('rejects an incomplete success payload without reading config, remembering it, or opening', async () => {
    const readConfig = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      importProjectFolder: async () => ({ ok: true, projectDir: '/p/unreadable', created: false }),
      readConfig,
    };

    const { getAllByRole, findAllByText, queryByText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: /Import layer folder/i })[0]!);

    expect((await findAllByText('Could not import layer folder')).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(getAllByRole('button', { name: /Import layer folder/i })[0]!.getAttribute('aria-busy')).toBeNull());
    expect(queryByText('Project loaded')).toBeNull();
    expect(queryByText(/Imported \d+ layers/)).toBeNull();
    expect(localStorage.getItem('cnftz:recents')).toBeNull();
    expect(readConfig).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('treats picker cancellation as a no-op without an error, toast, config read, or open callback', async () => {
    const importProjectFolder = vi.fn(async () => ({ ok: false, cancelled: true }));
    const readConfig = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: false }),
      importProjectFolder,
      readConfig,
    };

    const { getAllByRole, queryByText, onOpened } = mount();
    fireEvent.click(getAllByRole('button', { name: /Import layer folder/i })[0]!);

    await waitFor(() => expect(importProjectFolder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getAllByRole('button', { name: /Import layer folder/i })[0]!.getAttribute('aria-busy')).toBeNull());
    expect(queryByText(/cancel/i)).toBeNull();
    expect(readConfig).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
  });
});
