import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
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
      </ProjectProvider>
    </ToastProvider>,
  );
  return { ...utils, onOpened };
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
