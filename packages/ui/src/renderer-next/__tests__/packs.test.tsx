import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PacksScreen } from '../screens/PacksScreen';
import { ToastProvider } from '../components';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function install(over: Record<string, any> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    packsList: async () => ({
      ok: true,
      packs: [
        { id: 'conkerco-default', name: 'CONKERCO Default', kind: 'pack', builtin: true },
        { id: 'pack-mine', name: 'My Pack', kind: 'pack', builtin: false },
      ],
    }),
    packsRead: async () => ({ ok: true, base64: PNG, mime: 'image/png' }),
    packsImport: async () => ({ ok: true, pack: { id: 'pack-new', name: 'New', kind: 'pack', builtin: false } }),
    packsDelete: async () => ({ ok: true }),
    ...over,
  };
}

function mount() {
  return render(
    <ToastProvider>
      <PacksScreen />
    </ToastProvider>,
  );
}

describe('PacksScreen', () => {
  it('lists built-in + custom library packs with the right badges', async () => {
    install();
    const { findByText, getAllByText } = mount();
    expect(await findByText('CONKERCO Default')).toBeTruthy();
    expect(await findByText('My Pack')).toBeTruthy();
    expect(getAllByText('BUILT-IN').length).toBeGreaterThan(0);
    expect(getAllByText('CUSTOM').length).toBeGreaterThan(0);
  });

  it('imports a pack into the library via the bridge', async () => {
    const packsImport = vi.fn(async () => ({ ok: true, pack: { id: 'pack-new', name: 'New', kind: 'pack', builtin: false } }));
    install({ packsImport });
    const { findByText, getByRole } = mount();
    await findByText('CONKERCO Default');
    fireEvent.click(getByRole('button', { name: '+ Pack' }));
    await waitFor(() => expect(packsImport).toHaveBeenCalled());
  });

  it('deletes only custom packs (built-ins have no delete)', async () => {
    const packsDelete = vi.fn(async () => ({ ok: true }));
    install({ packsDelete });
    const { findByLabelText, queryByLabelText } = mount();
    // Built-in has no delete control; custom does.
    expect(queryByLabelText('Delete CONKERCO Default')).toBeNull();
    fireEvent.click(await findByLabelText('Delete My Pack'));
    await waitFor(() => expect(packsDelete).toHaveBeenCalledWith('pack-mine'));
  });
});
