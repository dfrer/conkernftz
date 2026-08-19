import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components';
import { TraitBrowser } from '../components/TraitBrowser';
import type { LayerCfg } from '../state/project';

const filenameLayer: LayerCfg = {
  name: 'Background',
  path: 'layers/bg',
  rarity: 'filename',
  required: true,
};

function renderBrowser(
  items: string[],
  options: {
    layer?: LayerCfg;
    delimiter?: string;
    scopeKey?: string;
    listDir?: (path: string) => Promise<{ ok: boolean; items?: string[]; error?: string }>;
    renameFileExact?: (
      from: string,
      to: string,
    ) => Promise<{ ok: boolean; renamed?: number; error?: string }>;
    onFilesChange?: (files: string[]) => void;
  } = {},
) {
  const renameFileExact = options.renameFileExact ?? vi.fn(async () => ({ ok: true, renamed: 1 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).foundry = {
    listDir: options.listDir ?? vi.fn(async () => ({ ok: true, items })),
    readFileBase64: vi.fn(async () => ({ ok: true, base64: '', mime: 'image/png' })),
    renameFileExact,
  };
  return {
    ...render(
      <ToastProvider>
        <TraitBrowser
          layer={options.layer ?? filenameLayer}
          delimiter={options.delimiter ?? '#'}
          defaultWeight={1}
          scopeKey={options.scopeKey ?? 'project-one'}
          onFilesChange={options.onFilesChange}
        />
      </ToastProvider>,
    ),
    renameFileExact,
  };
}

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

describe('TraitBrowser rarity editor', () => {
  it('renames exactly one asset, then reloads its odds and reports actual filenames upward', async () => {
    const items = ['Gold#1.png', 'Gold#3.webp'];
    const onFilesChange = vi.fn();
    const renameFileExact = vi.fn(async (from: string, to: string) => {
      expect([from, to]).toEqual(['layers/bg/Gold#1.png', 'layers/bg/Gold#2.png']);
      items.splice(0, 1, 'Gold#2.png');
      return { ok: true, renamed: 1 };
    });
    const view = renderBrowser(items, { renameFileExact, onFilesChange });

    fireEvent.click(await view.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    const weight = await view.findByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' });
    fireEvent.change(weight, { target: { value: '2' } });
    fireEvent.click(view.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));

    await waitFor(() => expect(renameFileExact).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onFilesChange).toHaveBeenLastCalledWith(['Gold#2.png', 'Gold#3.webp']),
    );
    expect(await view.findByText('40.0%')).toBeTruthy();
    expect(view.getByText('w2')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Edit rarity for Gold#3.webp' })).toBeTruthy();
    const renamedEdit = await view.findByRole('button', { name: 'Edit rarity for Gold#2.png' });
    expect(document.activeElement).toBe(renamedEdit);
    fireEvent.keyDown(renamedEdit, { key: 'Enter' });
    expect(
      await view.findByRole('spinbutton', { name: 'Rarity weight for Gold#2.png' }),
    ).toBeTruthy();
  });

  it('blocks invalid weights, unchanged filenames, and case-insensitive target collisions before IPC', async () => {
    const renameFileExact = vi.fn(async () => ({ ok: true, renamed: 1 }));
    const invalid = renderBrowser(['Gold#1.png'], { renameFileExact });
    fireEvent.click(await invalid.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(invalid.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '1.5' },
    });
    const invalidInput = invalid.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' });
    expect(invalidInput.getAttribute('min')).toBe('1');
    expect(invalidInput.getAttribute('step')).toBe('1');
    expect(await invalid.findByText('Enter a positive whole-number weight.')).toBeTruthy();
    expect(
      (invalid.getByRole('button', { name: 'Apply rarity for Gold#1.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(renameFileExact).not.toHaveBeenCalled();
    invalid.unmount();

    const noOp = renderBrowser(['Gold#2.png'], { renameFileExact });
    fireEvent.click(await noOp.findByRole('button', { name: 'Edit rarity for Gold#2.png' }));
    expect(await noOp.findByText('Enter a new weight to change rarity.')).toBeTruthy();
    expect(noOp.queryByRole('alert')).toBeNull();
    expect(
      (noOp.getByRole('button', { name: 'Apply rarity for Gold#2.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    noOp.unmount();

    const collision = renderBrowser(['Gold#1.png', 'Gold#2.PNG'], { renameFileExact });
    fireEvent.click(await collision.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(collision.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    expect(await collision.findByText('Another asset already uses Gold#2.png.')).toBeTruthy();
    expect(
      (collision.getByRole('button', { name: 'Apply rarity for Gold#1.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(renameFileExact).not.toHaveBeenCalled();
  });

  it('keeps the original view when the bridge fails or reports no rename', async () => {
    const noRename = vi.fn(async () => ({ ok: true, renamed: 0 }));
    const zero = renderBrowser(['Gold#1.png'], { renameFileExact: noRename });
    fireEvent.click(await zero.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(zero.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    fireEvent.click(zero.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));
    expect(
      await zero.findByText('No file was renamed. Refresh the layer and try again.'),
    ).toBeTruthy();
    expect(zero.getByText('w1')).toBeTruthy();
    zero.unmount();

    const failedItems = ['Gold#1.png'];
    const onFilesChange = vi.fn();
    const failed = vi.fn(async () => {
      // Simulate a rollback failure: the source remains while a partial target is now visible.
      failedItems.push('Gold#3.png');
      return { ok: false, error: 'Disk denied' };
    });
    const error = renderBrowser(failedItems, { renameFileExact: failed, onFilesChange });
    fireEvent.click(await error.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(error.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '3' },
    });
    fireEvent.click(error.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));
    expect(await error.findByText('Disk denied')).toBeTruthy();
    await waitFor(() =>
      expect(onFilesChange).toHaveBeenLastCalledWith(['Gold#1.png', 'Gold#3.png']),
    );
    expect(await error.findByRole('button', { name: 'Edit rarity for Gold#3.png' })).toBeTruthy();
    expect(error.getByText('w1')).toBeTruthy();
  });

  it('does not expose ignored JPEG files and blocks delimiters that would create a path', async () => {
    const renameFileExact = vi.fn(async () => ({ ok: true, renamed: 1 }));
    const catalog = renderBrowser(['Gold#2.8.png', 'Ignored#9.JPG', 'Also ignored#1.jpeg'], {
      renameFileExact,
    });
    expect(await catalog.findByText('1 ASSETS · rarest first')).toBeTruthy();
    expect(catalog.getByText('w2')).toBeTruthy();
    expect(catalog.queryByRole('button', { name: /Ignored#9\.JPG/ })).toBeNull();
    catalog.unmount();

    const unsafe = renderBrowser(['Gold#1.png'], { delimiter: '/', renameFileExact });
    fireEvent.click(await unsafe.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    expect(
      await unsafe.findByText(
        'Choose a filename delimiter without slashes or control characters in the layer settings.',
      ),
    ).toBeTruthy();
    expect(
      (unsafe.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (unsafe.getByRole('button', { name: 'Apply rarity for Gold#1.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(renameFileExact).not.toHaveBeenCalled();
    unsafe.unmount();

    const nul = renderBrowser(['Gold#1.png'], { delimiter: '\0', renameFileExact });
    fireEvent.click(await nul.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    expect(
      await nul.findByText(
        'Choose a filename delimiter without slashes or control characters in the layer settings.',
      ),
    ).toBeTruthy();
    expect(
      (nul.getByRole('button', { name: 'Apply rarity for Gold#1.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(renameFileExact).not.toHaveBeenCalled();
  });

  it('keeps refreshed disk truth visible if an exact target is not present after a reported rename', async () => {
    const items = ['Gold#1.png'];
    const renameFileExact = vi.fn(async () => {
      items.splice(0, 1, 'Gold#2_1.png');
      return { ok: true, renamed: 1 };
    });
    const view = renderBrowser(items, { renameFileExact });
    fireEvent.click(await view.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(view.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));

    expect(
      await view.findByText(
        'Rename did not produce Gold#2.png. The layer was refreshed; check the asset name before trying again.',
      ),
    ).toBeTruthy();
    expect(await view.findByRole('button', { name: 'Edit rarity for Gold#2_1.png' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Edit rarity for Gold#1.png' })).toBeNull();
  });

  it('ignores an in-flight rename after the layer changes or the browser unmounts', async () => {
    let resolveRename: (result: { ok: boolean; renamed?: number }) => void = () => undefined;
    const renameFileExact = vi.fn(
      () =>
        new Promise<{ ok: boolean; renamed?: number }>((resolve) => {
          resolveRename = resolve;
        }),
    );
    const listDir = vi.fn(async (path: string) => ({
      ok: true,
      items: path === 'layers/next' ? ['Next#1.png'] : ['Gold#1.png'],
    }));
    const onFilesChange = vi.fn();
    const view = renderBrowser(['Gold#1.png'], { listDir, renameFileExact, onFilesChange });
    fireEvent.click(await view.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(view.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));
    await waitFor(() => expect(renameFileExact).toHaveBeenCalledTimes(1));

    view.rerender(
      <ToastProvider>
        <TraitBrowser
          layer={{ ...filenameLayer, path: 'layers/next' }}
          delimiter="#"
          defaultWeight={1}
          scopeKey="project-two"
          onFilesChange={onFilesChange}
        />
      </ToastProvider>,
    );
    await view.findByRole('button', { name: 'Edit rarity for Next#1.png' });
    onFilesChange.mockClear();
    const listCallsAfterLayerChange = listDir.mock.calls.length;
    resolveRename({ ok: true, renamed: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(listDir).toHaveBeenCalledTimes(listCallsAfterLayerChange);
    expect(onFilesChange).not.toHaveBeenCalled();
    expect(view.queryByText('Rarity updated: 2')).toBeNull();

    let resolveUnmountedRename: (result: { ok: boolean; renamed?: number }) => void = () =>
      undefined;
    const unmountedRename = vi.fn(
      () =>
        new Promise<{ ok: boolean; renamed?: number }>((resolve) => {
          resolveUnmountedRename = resolve;
        }),
    );
    const unmountedFilesChange = vi.fn();
    const unmounted = renderBrowser(['Gold#1.png'], {
      renameFileExact: unmountedRename,
      onFilesChange: unmountedFilesChange,
    });
    fireEvent.click(await unmounted.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(unmounted.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    fireEvent.click(unmounted.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));
    await waitFor(() => expect(unmountedRename).toHaveBeenCalledTimes(1));
    unmountedFilesChange.mockClear();
    unmounted.unmount();
    resolveUnmountedRename({ ok: true, renamed: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(unmountedFilesChange).not.toHaveBeenCalled();
  });

  it('invalidates an in-flight rename when a new project reuses the same layer path', async () => {
    let resolveRename: (result: { ok: boolean; renamed?: number }) => void = () => undefined;
    const renameFileExact = vi.fn(
      () =>
        new Promise<{ ok: boolean; renamed?: number }>((resolve) => {
          resolveRename = resolve;
        }),
    );
    let projectFiles = ['Gold#1.png'];
    const listDir = vi.fn(async () => ({ ok: true, items: projectFiles }));
    const onFilesChange = vi.fn();
    const view = renderBrowser(projectFiles, {
      listDir,
      renameFileExact,
      onFilesChange,
      scopeKey: 'project-one',
    });
    fireEvent.click(await view.findByRole('button', { name: 'Edit rarity for Gold#1.png' }));
    fireEvent.change(view.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }), {
      target: { value: '2' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Apply rarity for Gold#1.png' }));
    await waitFor(() => expect(renameFileExact).toHaveBeenCalledTimes(1));

    projectFiles = ['New project#1.png'];
    view.rerender(
      <ToastProvider>
        <TraitBrowser
          layer={filenameLayer}
          delimiter="#"
          defaultWeight={1}
          scopeKey="project-two"
          onFilesChange={onFilesChange}
        />
      </ToastProvider>,
    );
    await view.findByRole('button', { name: 'Edit rarity for New project#1.png' });
    onFilesChange.mockClear();
    const listCallsAfterProjectChange = listDir.mock.calls.length;
    resolveRename({ ok: true, renamed: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(listDir).toHaveBeenCalledTimes(listCallsAfterProjectChange);
    expect(onFilesChange).not.toHaveBeenCalled();
    expect(view.queryByText('Rarity updated: 2')).toBeNull();
  });

  it('keeps the disclosure labelled and keyboard-focusable while uniform rarity disables filename application', async () => {
    const renameFileExact = vi.fn(async () => ({ ok: true, renamed: 1 }));
    const view = renderBrowser(['Gold#1.png'], {
      layer: { ...filenameLayer, rarity: 'uniform' },
      renameFileExact,
    });
    const edit = await view.findByRole('button', { name: 'Edit rarity for Gold#1.png' });
    edit.focus();
    expect(document.activeElement).toBe(edit);
    expect(edit.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(edit);
    expect(edit.getAttribute('aria-expanded')).toBe('true');
    expect(await view.findByText(/Uniform rarity ignores filename weights/)).toBeTruthy();
    expect(
      (view.getByRole('spinbutton', { name: 'Rarity weight for Gold#1.png' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole('button', { name: 'Apply rarity for Gold#1.png' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(renameFileExact).not.toHaveBeenCalled();
  });
});
