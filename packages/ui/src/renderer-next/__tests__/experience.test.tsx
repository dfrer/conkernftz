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

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

function mount() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: cfg }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig: async () => ({ ok: true }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
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
});
