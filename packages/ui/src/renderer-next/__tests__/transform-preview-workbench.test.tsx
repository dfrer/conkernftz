import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { TransformPreviewWorkbench, explainTransformPreview, matchTransformPreviewSample } from '../components/TransformPreviewWorkbench';
import { TransformRulesEditor, type TransformRuleValue } from '../components/TransformRulesEditor';

const readFileBase64 = vi.hoisted(() => vi.fn());
vi.mock('../lib/bridge', () => ({ bridge: () => ({ readFileBase64 }) }));

const catalog = [
  { layer: 'Body', path: 'layers/body', values: ['Tilted', 'Robot'], filenames: ['Tilted#1.png', 'Robot#1.png'] },
  { layer: 'Eyes', path: 'layers/eyes', values: ['Laser', 'Open'], filenames: ['Laser#1.png', 'Open#1.png'] },
];
const rule: TransformRuleValue = { target: { layer: 'Body' }, when: { allOf: ['Body:Robot'], anyOf: ['Eyes:Laser'] }, translate: { x: 0, y: 0, mode: 'add' } };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('TransformPreviewWorkbench', () => {
  it('keeps a 1536 by 1024 preview in one bounded 3:2 stage instead of stretching its checkerboard wrapper', () => {
    const { getByRole } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={[{ id: 'nasa', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['NASAID'], filenames: ['NASAID.png'] }]} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);
    const stage = getByRole('group', { name: /Preview affected layer Visual Identity/ });
    const canvas = getByRole('img', { name: 'Layered transform sample art' });

    expect(stage.style.aspectRatio).toBe('1536 / 1024');
    expect(stage.style.width).toBe('720px');
    expect(stage.style.maxWidth).toBe('100%');
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });

  it('starts a NASA-style any-of rule on an available non-first POPPieceOfPlastic asset', async () => {
    readFileBase64.mockResolvedValue({ ok: true, base64: 'sample', mime: 'image/png' });
    const nasaCatalog = [
      { id: 'visual-identity', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['NASAID'], filenames: ['NASAID.png'] },
      { id: 'pop', layer: 'POPPieceOfPlastic', path: 'layers/pop', values: ['Not a match', 'PieLogistics'], filenames: ['Other.png', 'PieLogistics.png'] },
    ];
    const nasaRule: TransformRuleValue = {
      target: { layer: 'Visual Identity' },
      when: { anyOf: ['POPPieceOfPlastic:KANSAS', 'POPPieceOfPlastic:PieLogistics', 'POPPieceOfPlastic:ILOVEICELAND'] },
    };
    const { getByRole } = render(<TransformPreviewWorkbench rule={nasaRule} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    await waitFor(() => expect(getByRole('status').textContent).toMatch(/satisfy the condition/i));
    expect(readFileBase64).toHaveBeenCalledWith('layers/pop/PieLogistics.png');
  });

  it('keeps a manually selected NASAID catalog asset and its data URL after condition matching rerenders', async () => {
    const nasaCatalog = [{
      id: 'visual-identity',
      layer: 'Visual Identity',
      path: 'layers/visual-identity',
      values: ['Broken Screen', 'NASAID', 'Mission Patch'],
      filenames: ['BrokenScreen.png', 'NASAID.png', 'MissionPatch.png'],
    }];
    readFileBase64.mockImplementation(async (path: string) => ({
      ok: true,
      mime: 'image/png',
      base64: path.slice(path.lastIndexOf('/') + 1),
    }));
    const { getByLabelText, getByRole, getByText, rerender } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);
    const asset = getByLabelText('Preview sample asset') as HTMLSelectElement;

    expect(Array.from(asset.options, (option) => option.value)).toEqual(['BrokenScreen.png', 'NASAID.png', 'MissionPatch.png']);
    fireEvent.change(asset, { target: { value: 'NASAID.png' } });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('NASAID.png'));
    expect(getByText('Visual Identity:NASAID')).toBeTruthy();

    rerender(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' }, when: { allOf: ['Visual Identity:Broken Screen'] } }} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    await waitFor(() => expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('NASAID.png'));
    expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('NASAID.png');
    expect(getByText('Visual Identity:NASAID')).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Match rule' }));
    await waitFor(() => expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('BrokenScreen.png'));
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('BrokenScreen.png'));
    expect(getByText('Visual Identity:Broken Screen')).toBeTruthy();
  });

  it('rematches a stale manual sample after its catalog asset is removed', async () => {
    const nasaCatalog = [{
      id: 'visual-identity',
      layer: 'Visual Identity',
      path: 'layers/visual-identity',
      values: ['Broken Screen', 'NASAID'],
      filenames: ['BrokenScreen.png', 'NASAID.png'],
    }];
    readFileBase64.mockImplementation(async (path: string) => ({ ok: true, mime: 'image/png', base64: path.slice(path.lastIndexOf('/') + 1) }));
    const { getByLabelText, getByRole, rerender } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} projectScope="nasa-project" onTranslateChange={vi.fn()} />);

    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'NASAID.png' } });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('NASAID.png'));
    rerender(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={[{ id: 'visual-identity', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['Broken Screen'], filenames: ['BrokenScreen.png'] }]} imageWidth={1536} imageHeight={1024} projectScope="nasa-project" onTranslateChange={vi.fn()} />);

    await waitFor(() => expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('BrokenScreen.png'));
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('BrokenScreen.png'));
  });

  it('clears a valid manual sample and rematches when the project scope changes', async () => {
    const nasaCatalog = [{
      id: 'visual-identity',
      layer: 'Visual Identity',
      path: 'layers/visual-identity',
      values: ['Broken Screen', 'NASAID'],
      filenames: ['BrokenScreen.png', 'NASAID.png'],
    }];
    readFileBase64.mockImplementation(async (path: string) => ({ ok: true, mime: 'image/png', base64: path.slice(path.lastIndexOf('/') + 1) }));
    const { getByLabelText, getByRole, rerender } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} projectScope="nasa-project-a" onTranslateChange={vi.fn()} />);

    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'NASAID.png' } });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('NASAID.png'));
    rerender(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} projectScope="nasa-project-b" onTranslateChange={vi.fn()} />);

    await waitFor(() => expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('BrokenScreen.png'));
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('BrokenScreen.png'));
  });

  it('keeps Match rule results for the selected non-first affected layer', async () => {
    const multiTargetCatalog = [
      { id: 'first', layer: 'First', path: 'layers/first', values: ['First Value'], filenames: ['First.png'] },
      { id: 'second', layer: 'Second', path: 'layers/second', values: ['Second Value'], filenames: ['Second.png'] },
    ];
    const multiTargetRule: TransformRuleValue = { target: { layers: ['First', 'Second'], values: ['Second Value'], filenames: ['Second.png'] } };
    readFileBase64.mockImplementation(async (path: string) => ({ ok: true, mime: 'image/png', base64: path.slice(path.lastIndexOf('/') + 1) }));
    const { getByLabelText, getByRole, getByText } = render(<TransformPreviewWorkbench rule={multiTargetRule} traitCatalog={multiTargetCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    fireEvent.change(getByLabelText('Preview affected layer'), { target: { value: 'second' } });
    fireEvent.change(getByLabelText('Preview sample layer'), { target: { value: 'second' } });
    fireEvent.click(getByRole('button', { name: 'Match rule' }));

    await waitFor(() => expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('Second.png'));
    expect(getByRole('status').textContent).toMatch(/match and satisfy/i);
    expect(getByText('First:First Value, Second:Second Value')).toBeTruthy();
    await waitFor(() => expect(Array.from(getByRole('img').querySelectorAll('image'), (image) => image.getAttribute('href'))).toContain('data:image/png;base64,Second.png'));
  });

  it('recovers a manually changed sample with the accessible Match rule action', () => {
    const nasaCatalog = [
      { id: 'visual-identity', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['NASAID'], filenames: ['NASAID.png'] },
      { id: 'pop', layer: 'POPPieceOfPlastic', path: 'layers/pop', values: ['Not a match', 'PieLogistics'], filenames: ['Other.png', 'PieLogistics.png'] },
    ];
    const nasaRule: TransformRuleValue = { target: { layer: 'Visual Identity' }, when: { anyOf: ['POPPieceOfPlastic:PieLogistics'] } };
    const { getByLabelText, getByRole } = render(<TransformPreviewWorkbench rule={nasaRule} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    fireEvent.change(getByLabelText('Preview sample layer'), { target: { value: 'pop' } });
    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'Other.png' } });
    expect(getByRole('status').textContent).toMatch(/Any of needs POPPieceOfPlastic:PieLogistics/);
    fireEvent.click(getByRole('button', { name: 'Match rule' }));
    expect(getByRole('status').textContent).toMatch(/match and satisfy/i);
    expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('PieLogistics.png');
  });

  it('keeps an impossible preview inactive and names the unavailable required trait', () => {
    const { getByRole } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' }, when: { allOf: ['POPPieceOfPlastic:KANSAS'] } }} traitCatalog={[
      { id: 'visual-identity', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['NASAID'], filenames: ['NASAID.png'] },
      { id: 'pop', layer: 'POPPieceOfPlastic', path: 'layers/pop', values: ['Other'], filenames: ['Other.png'] },
    ]} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    expect(getByRole('status').textContent).toBe('Unavailable POPPieceOfPlastic:KANSAS.');
    expect(getByRole('group', { name: /Inactive preview/ })).toBeTruthy();
  });

  it('builds a safe all-of and none-of sample from actual catalog values and filenames', () => {
    const matched = matchTransformPreviewSample({ target: { layer: 'Body' }, when: { allOf: ['Body:Robot'], noneOf: ['Eyes:Laser'] } }, catalog, catalog[0]);

    expect(matched).toMatchObject({ matchable: true });
    expect(matched.samples).toMatchObject({ '0\0layers/body\0Body': 'Robot#1.png', '1\0layers/eyes\0Eyes': 'Open#1.png' });
  });

  it('bounds portrait previews by a height-derived width while preserving source aspect', () => {
    const { getByRole } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Visual Identity' } }} traitCatalog={[{ id: 'portrait', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['Tall'], filenames: ['Tall.png'] }]} imageWidth={900} imageHeight={1800} onTranslateChange={vi.fn()} />);
    const stage = getByRole('group', { name: /Preview affected layer Visual Identity/ });

    expect(stage.dataset.orientation).toBe('portrait');
    expect(stage.style.aspectRatio).toBe('900 / 1800');
    expect(stage.style.width).toBe('280px');
  });

  it('preserves a manual inactive sample across numeric edits but rematches when criteria change', () => {
    const nasaCatalog = [
      { id: 'visual-identity', layer: 'Visual Identity', path: 'layers/visual-identity', values: ['NASAID'], filenames: ['NASAID.png'] },
      { id: 'pop', layer: 'POPPieceOfPlastic', path: 'layers/pop', values: ['Other', 'PieLogistics'], filenames: ['Other.png', 'PieLogistics.png'] },
    ];
    const nasaRule: TransformRuleValue = { target: { layer: 'Visual Identity' }, when: { anyOf: ['POPPieceOfPlastic:PieLogistics'] } };
    const { getByLabelText, getByRole, rerender } = render(<TransformPreviewWorkbench rule={nasaRule} traitCatalog={nasaCatalog} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);

    fireEvent.change(getByLabelText('Preview sample layer'), { target: { value: 'pop' } });
    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'Other.png' } });
    rerender(<TransformPreviewWorkbench rule={{ ...nasaRule, translate: { x: 12, y: -4 }, rotate: { degrees: 15 }, scale: { factor: 1.2 } }} traitCatalog={[...nasaCatalog]} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);
    expect((getByLabelText('Preview sample asset') as HTMLSelectElement).value).toBe('Other.png');
    rerender(<TransformPreviewWorkbench rule={{ ...nasaRule, when: { anyOf: ['POPPieceOfPlastic:Other'] } }} traitCatalog={[...nasaCatalog]} imageWidth={1536} imageHeight={1024} onTranslateChange={vi.fn()} />);
    expect(getByRole('status').textContent).toMatch(/match and satisfy/i);
  });

  it('searches later relevant candidates instead of declaring an any-of and none-of conflict impossible', () => {
    const matched = matchTransformPreviewSample({ target: { layer: 'Body' }, when: { noneOf: ['Eyes:Laser'], anyOf: ['Eyes:Laser', 'Body:Robot'] } }, catalog, catalog[0]);

    expect(matched).toMatchObject({ matchable: true });
    expect(matched.samples).toMatchObject({ '0\0layers/body\0Body': 'Robot#1.png', '1\0layers/eyes\0Eyes': 'Open#1.png' });
  });

  it('finds a later candidate that avoids a nested NOT conflict', () => {
    const matched = matchTransformPreviewSample({ target: { layer: 'Body' }, when: { anyOf: ['Eyes:Open'], not: { anyOf: ['Body:Robot', 'Eyes:Laser'] } } }, catalog, catalog[0]);

    expect(matched).toMatchObject({ matchable: true });
    expect(matched.samples).toMatchObject({ '0\0layers/body\0Body': 'Tilted#1.png', '1\0layers/eyes\0Eyes': 'Open#1.png' });
  });

  it('preserves an empty target value and selects its catalog-backed filename', () => {
    const emptyValueCatalog = [{ id: 'body', layer: 'Body', path: 'layers/body', values: ['', 'Robot'], filenames: ['Empty.png', 'Robot.png'] }];
    const matched = matchTransformPreviewSample({ target: { layer: 'Body', values: [''] } }, emptyValueCatalog, emptyValueCatalog[0]);

    expect(matched).toMatchObject({ matchable: true, samples: { body: 'Empty.png' } });
  });

  it('explains deterministic active and inactive samples', () => {
    expect(explainTransformPreview(rule, { Body: 'Tilted', Eyes: 'Laser' }, 'Body', 'Tilted#1.png')).toMatchObject({ active: false, reason: expect.stringMatching(/Body:Robot/) });
    expect(explainTransformPreview(rule, { Body: 'Robot', Eyes: 'Laser' }, 'Body', 'Robot#1.png')).toMatchObject({ active: true, reason: expect.stringMatching(/match/i) });
  });

  it('changes the selected sample trait and scales pointer drag coordinates to source pixels', () => {
    const onTranslateChange = vi.fn();
    const { getByLabelText, getByRole } = render(<TransformPreviewWorkbench rule={rule} traitCatalog={catalog} imageWidth={1000} imageHeight={500} onTranslateChange={onTranslateChange} />);
    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'Robot#1.png' } });
    expect(getByRole('status').textContent).toMatch(/match/i);
    const stage = getByRole('group', { name: /Preview affected layer Body/ });
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => ({ width: 400, height: 200 }) });
    Object.defineProperty(getByRole('img'), 'getBoundingClientRect', { value: () => ({ width: 200, height: 100 }) });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 30, clientY: 20 });
    expect(onTranslateChange).toHaveBeenLastCalledWith(100, 50);
  });

  it('clears a drag when pointer capture is lost', () => {
    const onTranslateChange = vi.fn();
    const activeRule: TransformRuleValue = { target: { layer: 'Body' }, translate: { x: 0, y: 0 } };
    const { getByRole } = render(<TransformPreviewWorkbench rule={activeRule} traitCatalog={catalog} imageWidth={1000} imageHeight={500} onTranslateChange={onTranslateChange} />);
    const stage = getByRole('group', { name: /Preview affected layer Body/ });
    Object.defineProperty(stage, 'getBoundingClientRect', { value: () => ({ width: 200, height: 100 }) });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.lostPointerCapture(stage, { pointerId: 1 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 30, clientY: 20 });
    expect(onTranslateChange).not.toHaveBeenCalled();
  });

  it('uses core-compatible targeting, condition boundaries, and stable duplicate layer identities', () => {
    const sample = { Body: 'Robot', Eyes: 'Laser' };
    expect(explainTransformPreview({ target: { layer: 'Body', filenames: ['ROBOT#1.PNG'] } }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: true });
    expect(explainTransformPreview({ target: { layer: 'Body', filenames: [''] } }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: true });
    expect(explainTransformPreview({ target: { layer: 'Eyes' } }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: false, reason: expect.stringMatching(/do not include/i) });
    expect(explainTransformPreview({ target: { layer: 'Body' }, when: { anyOf: 'Body:Robot' } as unknown as TransformRuleValue['when'] }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: false, reason: expect.stringMatching(/invalid condition/i) });
    const longAny = [...Array.from({ length: 300 }, () => 'Body:Tilted'), 'Body:Robot'];
    expect(explainTransformPreview({ target: { layer: 'Body' }, when: { anyOf: longAny } }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: true });
    let acceptedDepth: Record<string, unknown> = {};
    for (let index = 0; index < 32; index += 1) acceptedDepth = { not: acceptedDepth };
    expect(explainTransformPreview({ target: { layer: 'Body' }, when: acceptedDepth }, sample, 'Body', 'Robot#1.png').reason).not.toMatch(/invalid condition/i);
    const rejectedDepth = { not: acceptedDepth };
    expect(explainTransformPreview({ target: { layer: 'Body' }, when: rejectedDepth }, sample, 'Body', 'Robot#1.png')).toMatchObject({ active: false, reason: expect.stringMatching(/invalid condition/i) });

    const duplicateCatalog = [
      { id: 'body-a', layer: 'Body', path: 'layers/body', values: ['A'], filenames: ['A.png'] },
      { id: 'body-b', layer: 'Body', path: 'layers/body', values: ['B'], filenames: ['B.png'] },
    ];
    const { getAllByRole } = render(<TransformPreviewWorkbench rule={{ target: { layer: 'Body' } }} traitCatalog={duplicateCatalog} imageWidth={100} imageHeight={50} onTranslateChange={vi.fn()} />);
    expect(getAllByRole('option', { name: 'Body — layers/body (1)' })).toHaveLength(2);
    expect(getAllByRole('option', { name: 'Body — layers/body (2)' })).toHaveLength(2);
  });

  it('models base and draft transform composition in the full-canvas expanded-buffer coordinate system', () => {
    const onTranslateChange = vi.fn();
    const geometryCatalog = [{
      id: 'body', layer: 'Body', path: 'layers/body', values: ['Robot'], filenames: ['Robot.png'],
      baseEffects: { offsetX: 5, offsetY: 7, rotate: 10, scale: 1.5 },
    }];
    const first: TransformRuleValue = { target: { layer: 'Body' }, priority: 0, translate: { x: 3, y: 2, mode: 'add' }, rotate: { degrees: 5, mode: 'add' }, scale: { factor: 2, mode: 'multiply' } };
    const current: TransformRuleValue = { target: { layer: 'Body' }, priority: 1, translate: { x: 12.4, y: 21.6, mode: 'add' }, rotate: { degrees: 30, mode: 'set' }, scale: { factor: 2, mode: 'set' } };
    readFileBase64.mockResolvedValue({ ok: true, base64: 'sample', mime: 'image/png' });
    const { getByRole } = render(<TransformPreviewWorkbench rule={current} rules={[first, current]} traitCatalog={geometryCatalog} imageWidth={100} imageHeight={50} onTranslateChange={onTranslateChange} />);
    return waitFor(() => {
      const group = getByRole('img', { name: 'Layered transform sample art' });
      const layer = group.querySelector('g');
      expect(layer?.getAttribute('transform')).toBe('translate(20 31) rotate(30 111.5 93.5)');
      const image = group.querySelector('image');
      expect(image?.getAttribute('width')).toBe('200');
      expect(image?.getAttribute('height')).toBe('100');
      expect(image?.getAttribute('preserveAspectRatio')).toBe('none');
    });
  });

  it('keeps a valid open preview mounted when an imported sibling rule is null', async () => {
    readFileBase64.mockResolvedValue({ ok: true, base64: 'sample', mime: 'image/png' });
    const valid: TransformRuleValue = { target: { layer: 'Body' }, translate: { x: 4, y: 0 } };
    const { findByRole } = render(<TransformRulesEditor value={[valid, null as unknown as TransformRuleValue]} onChange={vi.fn()} layerNames={['Body']} traitCatalog={[{ id: 'body', layer: 'Body', path: 'layers/body', values: ['Robot'], filenames: ['Robot.png'] }]} imageWidth={100} imageHeight={50} />);
    expect(await findByRole('group', { name: /Preview affected layer Body/ })).toBeTruthy();
  });

  it('clears immediately and rejects late asset loads from earlier project or sample scopes', async () => {
    const first = deferred<{ ok: boolean; base64: string; mime: string }>();
    const second = deferred<{ ok: boolean; base64: string; mime: string }>();
    const third = deferred<{ ok: boolean; base64: string; mime: string }>();
    const fourth = deferred<{ ok: boolean; base64: string; mime: string }>();
    const fifth = deferred<{ ok: boolean; base64: string; mime: string }>();
    readFileBase64.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise).mockImplementationOnce(() => third.promise).mockImplementationOnce(() => fourth.promise).mockImplementationOnce(() => fifth.promise);
    const oneLayer = [{ id: 'body', layer: 'Body', path: 'layers/body', values: ['First', 'Second'], filenames: ['First.png', 'Second.png'] }];
    const activeRule: TransformRuleValue = { target: { layer: 'Body' } };
    const { getByLabelText, getByRole, queryByText, rerender } = render(<TransformPreviewWorkbench rule={activeRule} traitCatalog={oneLayer} imageWidth={100} imageHeight={50} projectScope="project-a" onTranslateChange={vi.fn()} />);
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledTimes(1));
    await act(async () => { first.resolve({ ok: true, base64: 'old-project', mime: 'image/png' }); });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('old-project'));
    rerender(<TransformPreviewWorkbench rule={activeRule} traitCatalog={oneLayer} imageWidth={100} imageHeight={50} projectScope="project-b" onTranslateChange={vi.fn()} />);
    expect(queryByText(/Loading deterministic sample art/)).not.toBeNull();
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledTimes(2));
    rerender(<TransformPreviewWorkbench rule={activeRule} traitCatalog={oneLayer} imageWidth={100} imageHeight={50} projectScope="project-c" onTranslateChange={vi.fn()} />);
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledTimes(3));
    await act(async () => { second.resolve({ ok: true, base64: 'late-project-b', mime: 'image/png' }); });
    expect(queryByText(/Loading deterministic sample art/)).not.toBeNull();
    await act(async () => { third.resolve({ ok: true, base64: 'new-project', mime: 'image/png' }); });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('new-project'));
    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'Second.png' } });
    expect(queryByText(/Loading deterministic sample art/)).not.toBeNull();
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledTimes(4));
    fireEvent.change(getByLabelText('Preview sample asset'), { target: { value: 'First.png' } });
    await waitFor(() => expect(readFileBase64).toHaveBeenCalledTimes(5));
    await act(async () => { fourth.resolve({ ok: true, base64: 'late-second-sample', mime: 'image/png' }); });
    expect(queryByText(/Loading deterministic sample art/)).not.toBeNull();
    await act(async () => { fifth.resolve({ ok: true, base64: 'new-sample', mime: 'image/png' }); });
    await waitFor(() => expect(getByRole('img').querySelector('image')?.getAttribute('href')).toContain('new-sample'));
  });

  it('provides keyboard nudges and keeps preview edits private until Apply or Cancel', () => {
    const onChange = vi.fn();
    const seeded: TransformRuleValue = { target: { layer: 'Body' }, when: { allOf: ['Body:Tilted'], anyOf: ['Eyes:Laser'] }, translate: { x: 12, y: -4, mode: 'add' } };
    const { getByLabelText, getByRole } = render(<TransformRulesEditor value={[seeded]} onChange={onChange} layerNames={['Body', 'Eyes']} traitCatalog={catalog} imageWidth={1024} imageHeight={1024} />);
    const stage = getByRole('group', { name: /Preview affected layer Body/ });
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect((getByLabelText('Transform 1 translate X') as HTMLInputElement).value).toBe('13');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect((getByLabelText('Transform 1 translate X') as HTMLInputElement).value).toBe('12');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(getByRole('group', { name: /Preview affected layer Body/ }), { key: 'ArrowRight' });
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ translate: expect.objectContaining({ x: 13 }) })]);
  });
});
