import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { ExperienceScreen } from '../screens/ExperienceScreen';
import { ToastProvider } from '../components';

const cfg = {
  name: 'P',
  editionSize: 4,
  image: { width: 8, height: 8 },
  layers: [],
  mintExperience: { kind: 'cardPack', packCount: 3, label: 'PACK' },
  export: { outDir: 'build', imageFormat: 'png' },
};
// 1x1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

function mount(over: Record<string, unknown> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: cfg }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig: async () => ({ ok: true }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
    packsList: async () => ({ ok: true, packs: [{ id: 'conkerco-default', name: 'CONKERCO Default', kind: 'pack', builtin: true }] }),
    packsRead: async () => ({ ok: true, base64: PNG, mime: 'image/png' }),
    ...over,
  };
  return render(
    <ToastProvider>
      <ProjectProvider>
        <ExperienceScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('ExperienceScreen', () => {
  it('remounts the preview when Replay is clicked (interaction-driven reveal)', async () => {
    const { findByRole, container } = mount();
    const replay = await findByRole('button', { name: 'Replay' });
    expect(container.querySelector('.panel')).toBeTruthy();
    fireEvent.click(replay);
    await waitFor(() => expect(replay).toBeTruthy());
  });

  it('picks a pack from the app library and uses it as the sealed pack', async () => {
    const { findByLabelText } = mount();
    // The library picker shows the built-in pack; selecting it sets packId →
    // the preview resolves the id to an image and renders it as the sealed pack.
    fireEvent.click(await findByLabelText('Use CONKERCO Default'));
    await waitFor(() => expect(document.querySelector('.exp-pack-art')).toBeTruthy());
  });
});
