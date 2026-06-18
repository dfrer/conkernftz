import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastProvider } from '../components';
import { SpawnEditor } from '../components/SpawnEditor';

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

const mapJson = JSON.stringify({
  version: 1,
  authoringSize: { width: 1024, height: 1024 },
  dots: [{ id: 'dot-1', x: 0.5, y: 0.5, weight: 1 }],
  mappings: { layerToDotIds: {} },
  rules: { selection: 'weighted', fitMode: 'contain', anchor: 'center' },
});

describe('SpawnEditor', () => {
  it('loads a map, toggles a layer→dot mapping, and saves it', async () => {
    const saveJson = vi.fn(async (_p: string, _json: unknown) => ({ ok: true }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = { readFile: async () => ({ ok: true, content: mapJson }), saveJson };
    const onMapPathChange = vi.fn();

    const { findByLabelText, getByRole } = render(
      <ToastProvider>
        <SpawnEditor layers={[{ name: 'BG', path: 'layers/bg' }]} mapPath="spawn-map.json" onMapPathChange={onMapPathChange} />
      </ToastProvider>,
    );

    fireEvent.click(await findByLabelText('BG uses dot-1'));
    fireEvent.click(getByRole('button', { name: 'Save spawn map' }));
    await waitFor(() => expect(saveJson).toHaveBeenCalled());
    const [path, saved] = saveJson.mock.calls[0]!;
    expect(path).toBe('spawn-map.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((saved as any).mappings.layerToDotIds.BG).toEqual(['dot-1']);
    expect(onMapPathChange).toHaveBeenCalledWith('spawn-map.json');
  });
});
