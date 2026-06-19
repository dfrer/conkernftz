import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../state/project';
import { BuildScreen } from '../screens/BuildScreen';
import { ToastProvider } from '../components';
import type { BuildProgressEvent } from '../lib/bridge';

const cfg = {
  name: 'B',
  editionSize: 4,
  image: { width: 8, height: 8 },
  layers: [],
  rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
  export: { outDir: 'build', imageFormat: 'png' },
};
// 1x1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function installBridge(over: Record<string, any> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    getProjectDir: async () => ({ ok: true, projectDir: '/p' }),
    setProjectDir: async () => ({ ok: true }),
    chooseProjectDir: async () => ({ ok: false }),
    readConfig: async () => ({ ok: true, json: cfg }),
    readConfigAt: async () => ({ ok: false }),
    writeConfig: async () => ({ ok: true }),
    readFile: async () => ({ ok: false }),
    listImages: async () => ({ ok: true, count: 0 }),
    listDir: async () => ({ ok: true, items: [] }),
    readFileBase64: async () => ({ ok: true, base64: PNG, mime: 'image/png' }),
    openInExplorer: async () => ({ ok: true }),
    previewLive: async () => ({ ok: true, format: 'png', images: [] }),
    buildWithProgress: vi.fn(async () => ({ ok: true, stdout: 'Build complete' })),
    pauseBuild: async () => ({ ok: true }),
    resumeBuild: async () => ({ ok: true }),
    stopBuild: async () => ({ ok: true }),
    onBuildProgress: () => undefined,
    auditAssets: async () => ({ ok: true, json: {} }),
    auditOutputs: async () => ({ ok: true, json: {} }),
    openExternal: async () => ({ ok: true }),
    ...over,
  };
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
        <BuildScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('BuildScreen', () => {
  it('builds and renders the rarity report', async () => {
    installBridge({
      buildWithProgress: vi.fn(async () => ({ ok: true, stdout: 'Built 4 editions to /p/build' })),
      readFile: vi.fn(async (rel: string) =>
        rel.endsWith('rarity.json')
          ? { ok: true, content: JSON.stringify({ editionCount: 4, traitCounts: { Body: { Red: 3, Green: 1 } } }) }
          : { ok: false },
      ),
    });
    const { findByText, getAllByRole } = mount();
    await findByText('Ready to build');
    fireEvent.click(getAllByRole('button', { name: 'Build collection' })[0]!);
    expect(await findByText(/Built 4 editions/)).toBeTruthy();
    expect(await findByText('Red')).toBeTruthy();
  });

  it('loads the built editions into the output gallery and opens a lightbox', async () => {
    installBridge({
      buildWithProgress: vi.fn(async () => ({ ok: true, stdout: 'Built 3 editions' })),
      listDir: vi.fn(async (rel: string) =>
        rel.endsWith('/images') ? { ok: true, items: ['1.png', '2.png', '3.png'] } : { ok: true, items: [] },
      ),
      readFileBase64: vi.fn(async () => ({ ok: true, base64: PNG, mime: 'image/png' })),
    });
    const { findByText, findByLabelText, getAllByRole, findByRole } = mount();
    await findByText('Ready to build');
    fireEvent.click(getAllByRole('button', { name: 'Build collection' })[0]!);
    // The gallery picks up the 3 built editions.
    await findByLabelText('Inspect edition 3');
    // Clicking an edition opens the shared inspection lightbox.
    fireEvent.click(await findByLabelText('Inspect edition 1'));
    expect(await findByRole('dialog')).toBeTruthy();
  });

  it('reflects live build progress events', async () => {
    let handler: ((d: BuildProgressEvent) => void) | null = null;
    installBridge({
      onBuildProgress: (h: (d: BuildProgressEvent) => void) => {
        handler = h;
      },
      buildWithProgress: () => new Promise<{ ok: boolean }>(() => undefined), // never resolves
    });
    const { findByText, getAllByRole, getByText } = mount();
    await findByText('Ready to build');
    fireEvent.click(getAllByRole('button', { name: 'Build collection' })[0]!);
    act(() => {
      handler?.({ current: 2, total: 4, progress: 50, message: 'Processing batch 1/2', isPaused: false });
    });
    expect(getByText('Processing batch 1/2')).toBeTruthy();
    expect(getByText(/50%/)).toBeTruthy();
  });
});
