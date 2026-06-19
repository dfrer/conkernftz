import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { PreviewScreen, resolvePreviewSeed } from '../screens/PreviewScreen';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function installBridge(previewLive: any) {
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
}

function mount() {
  return render(
    <ToastProvider>
      <ProjectProvider>
        <PreviewScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
  localStorage.clear();
});

describe('resolvePreviewSeed', () => {
  it('returns a trimmed custom seed, or a random one when empty', () => {
    expect(resolvePreviewSeed('  my-seed ')).toBe('my-seed');
    expect(resolvePreviewSeed('')).toMatch(/^studio-next:/);
    expect(resolvePreviewSeed('   ')).toMatch(/^studio-next:/);
  });
});

describe('PreviewScreen', () => {
  it('renders previews returned by the bridge on Generate', async () => {
    const previewLive = vi.fn(async () => ({ ok: true, format: 'png', images: [PNG, PNG, PNG] }));
    installBridge(previewLive);
    const { findByText, getAllByRole, findAllByRole } = mount();

    await findByText('No previews yet');
    fireEvent.click(getAllByRole('button', { name: 'Generate previews' })[0]!);

    const imgs = await findAllByRole('img');
    expect(imgs).toHaveLength(3);
    expect(previewLive).toHaveBeenCalledTimes(1);
  });

  it('passes a custom seed to the bridge and opens a lightbox on thumbnail click', async () => {
    const previewLive = vi.fn(async () => ({ ok: true, format: 'png', images: [PNG, PNG] }));
    installBridge(previewLive);
    const { findByText, getAllByRole, findByLabelText, findByRole } = mount();

    await findByText('No previews yet');
    fireEvent.change(await findByLabelText('Seed'), { target: { value: 'fixed-1' } });
    fireEvent.click(getAllByRole('button', { name: 'Generate previews' })[0]!);

    // The exact seed reaches the engine (reproducibility).
    await findByLabelText('Inspect preview 1');
    expect(previewLive).toHaveBeenCalledWith(expect.anything(), expect.any(Number), 'fixed-1');

    // Clicking a thumbnail opens the inspection lightbox.
    fireEvent.click(await findByLabelText('Inspect preview 1'));
    expect(await findByRole('dialog')).toBeTruthy();
  });
});
