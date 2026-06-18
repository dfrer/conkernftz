import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastProvider } from '../components';
import { RenamerPanel } from '../components/RenamerPanel';

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

describe('RenamerPanel', () => {
  it('applies uniform rarity weights via renameFiles', async () => {
    const renameFiles = vi.fn(async (_pairs: { from: string; to: string }[]) => ({ ok: true, renamed: 2 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      listDir: async () => ({ ok: true, items: ['Red.png', 'Blue#3.png'] }),
      renameFiles,
    };
    const { findByRole } = render(
      <ToastProvider>
        <RenamerPanel layers={[{ name: 'BG', path: 'layers/bg' }]} delimiter="#" />
      </ToastProvider>,
    );
    fireEvent.click(await findByRole('button', { name: 'Apply (2)' }));
    await waitFor(() => expect(renameFiles).toHaveBeenCalled());
    const pairs = renameFiles.mock.calls[0]![0];
    expect(pairs).toContainEqual({ from: 'layers/bg/Red.png', to: 'layers/bg/Red#1.png' });
    expect(pairs).toContainEqual({ from: 'layers/bg/Blue#3.png', to: 'layers/bg/Blue#1.png' });
  });
});
