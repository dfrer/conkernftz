import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { PreviewScreen } from '../screens/PreviewScreen';
import { ToastProvider } from '../components';

const cfg = {
  name: 'P',
  editionSize: 4,
  image: { width: 8, height: 8 },
  layers: [],
  rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
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

describe('PreviewScreen', () => {
  it('renders previews returned by the bridge on Generate', async () => {
    const previewLive = vi.fn(async () => ({ ok: true, format: 'png', images: [PNG, PNG, PNG] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
      setProjectDir: async () => ({ ok: true }),
      chooseProjectDir: async () => ({ ok: false }),
      readConfig: async () => ({ ok: true, json: cfg }),
      readConfigAt: async () => ({ ok: false }),
      writeConfig: async () => ({ ok: true }),
      listImages: async () => ({ ok: true, count: 0 }),
      previewLive,
      openExternal: async () => ({ ok: true }),
    };

    const { findByText, getAllByRole, findAllByRole } = render(
      <ToastProvider>
        <ProjectProvider>
          <PreviewScreen />
        </ProjectProvider>
      </ToastProvider>,
    );

    // Wait for the project to load (idle empty state appears).
    await findByText('No previews yet');
    fireEvent.click(getAllByRole('button', { name: 'Generate previews' })[0]!);

    const imgs = await findAllByRole('img');
    expect(imgs).toHaveLength(3);
    expect(previewLive).toHaveBeenCalledTimes(1);
  });
});
