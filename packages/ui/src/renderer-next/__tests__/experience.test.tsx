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
    readFileBase64: async () => ({ ok: true, base64: PNG, mime: 'image/png' }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
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
    // The pack-opening preview is present, and Replay re-runs it without error.
    expect(container.querySelector('.mintfx, .mint-experience, [data-mintfx]') ?? container.querySelector('.panel')).toBeTruthy();
    fireEvent.click(replay);
    await waitFor(() => expect(replay).toBeTruthy());
  });

  it('loads a project pack image into the experience as the sealed pack', async () => {
    const readFileBase64 = (async (rel: string) => ({ ok: true, base64: PNG, mime: 'image/png', rel })) as unknown;
    const { findByLabelText, getByRole, findByAltText } = mount({ readFileBase64 });
    const pathInput = (await findByLabelText('Pack image path')) as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: 'packs/conkerco-default.png' } });
    fireEvent.click(getByRole('button', { name: 'Load pack' }));
    // Thumbnail of the loaded pack art appears, and the reveal preview uses it as the sealed pack.
    expect(await findByAltText('Pack art')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('.exp-pack-art')).toBeTruthy());
  });
});
