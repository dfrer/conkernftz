import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ToastProvider } from '../components';
import { ProjectProvider } from '../state/project';
import { FalScreen } from '../screens/FalScreen';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

function mount() {
  return render(
    <ToastProvider>
      <ProjectProvider>
        <FalScreen />
      </ProjectProvider>
    </ToastProvider>,
  );
}

describe('FalScreen', () => {
  it('generates via fal.run and renders the image', async () => {
    const fetchMock = vi.fn(async (_url: string, _opts: RequestInit) => ({
      ok: true,
      json: async () => ({ images: [{ url: 'https://fal.media/out.png' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { getByLabelText, getByRole, findByAltText } = mount();
    fireEvent.change(getByLabelText('fal.ai API key'), { target: { value: 'test-key' } });
    fireEvent.change(getByLabelText('Prompt'), { target: { value: 'a cat in a spacesuit' } });
    fireEvent.click(getByRole('button', { name: 'Generate' }));
    expect(await findByAltText('Result 1')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalled();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://fal.run/fal-ai/flux/dev');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((opts as any).headers.Authorization).toBe('Key test-key');
  });

  it('switches the endpoint when a different catalog model is selected', async () => {
    const fetchMock = vi.fn(async (_url: string, _opts: RequestInit) => ({
      ok: true,
      json: async () => ({ images: [{ url: 'https://fal.media/out.png' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { getByLabelText, getByRole } = mount();
    fireEvent.change(getByLabelText('fal.ai API key'), { target: { value: 'k' } });
    fireEvent.change(getByLabelText('Model'), { target: { value: 'flux/schnell' } });
    fireEvent.change(getByLabelText('Prompt'), { target: { value: 'x' } });
    fireEvent.click(getByRole('button', { name: 'Generate' }));
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://fal.run/fal-ai/flux/schnell');
  });

  it('does not call fal without an API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { getByLabelText, getByRole } = mount();
    fireEvent.change(getByLabelText('Prompt'), { target: { value: 'x' } });
    fireEvent.click(getByRole('button', { name: 'Generate' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
