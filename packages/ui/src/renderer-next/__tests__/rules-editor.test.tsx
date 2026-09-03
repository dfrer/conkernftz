import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ToastProvider } from '../components';
import { RulesEditor, type RulesObj } from '../components/RulesEditor';

afterEach(cleanup);

function mount(value: RulesObj) {
  const setRules = vi.fn();
  const r = render(
    <ToastProvider>
      <RulesEditor value={value} setRules={setRules} />
    </ToastProvider>,
  );
  return { ...r, setRules };
}

describe('RulesEditor', () => {
  it('adds a max-occurrences cap and preserves transforms (lossless)', () => {
    const { getByRole, setRules } = mount({ transforms: [{ id: 't1' }] });
    fireEvent.click(getByRole('button', { name: '+ Add cap' }));
    expect(setRules).toHaveBeenCalledWith(
      expect.objectContaining({ maxOccurrences: [{ trait: '', max: 1 }], transforms: [{ id: 't1' }] }),
    );
  });

  it('adds a distribution target and preserves transforms (lossless)', () => {
    const { getByRole, setRules } = mount({ transforms: [{ id: 't1' }] });
    fireEvent.click(getByRole('button', { name: '+ Add target' }));
    expect(setRules).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [{ trait: '', count: 0 }], transforms: [{ id: 't1' }] }),
    );
  });

  it('edits a distribution target count', () => {
    const { getByLabelText, setRules } = mount({ targets: [{ trait: 'Background:Gold', count: 0 }] });
    fireEvent.change(getByLabelText('Target count 1'), { target: { value: '100' } });
    expect(setRules).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [{ trait: 'Background:Gold', count: 100 }] }),
    );
  });

  it('edits a max-occurrences trait', () => {
    const { getByLabelText, setRules } = mount({ maxOccurrences: [{ trait: 'X', max: 2 }] });
    fireEvent.change(getByLabelText('Max occurrence trait 1'), { target: { value: 'Background:Gold' } });
    expect(setRules).toHaveBeenCalledWith(
      expect.objectContaining({ maxOccurrences: [{ trait: 'Background:Gold', max: 2 }] }),
    );
  });

  it('normalizes common rule counts to core-valid whole numbers', () => {
    const { getByLabelText, setRules } = mount({
      maxOccurrences: [{ trait: 'A', max: 2 }],
      targets: [{ trait: 'B', count: 3 }],
    });
    fireEvent.change(getByLabelText('Max occurrence count 1'), { target: { value: '0' } });
    expect(setRules).toHaveBeenLastCalledWith(expect.objectContaining({ maxOccurrences: [{ trait: 'A', max: 1 }] }));
    fireEvent.change(getByLabelText('Target count 1'), { target: { value: '1.5' } });
    expect(setRules).toHaveBeenLastCalledWith(expect.objectContaining({ targets: [{ trait: 'B', count: 0 }] }));
  });

  it('applies advanced JSON, replacing the rules object', () => {
    const { getByLabelText, getByRole, setRules } = mount({});
    fireEvent.change(getByLabelText('Rules JSON'), { target: { value: '{"maxOccurrences":[{"trait":"A","max":3}]}' } });
    fireEvent.click(getByRole('button', { name: 'Apply JSON' }));
    expect(setRules).toHaveBeenCalledWith({ maxOccurrences: [{ trait: 'A', max: 3 }] });
  });

  it('rejects an array as the rules object', () => {
    const { getByLabelText, getByRole, setRules } = mount({});
    fireEvent.change(getByLabelText('Rules JSON'), { target: { value: '[]' } });
    fireEvent.click(getByRole('button', { name: 'Apply JSON' }));
    expect(getByRole('alert').textContent).toMatch(/Rules must be an object/);
    expect(setRules).not.toHaveBeenCalled();
  });

  it('merges an applied transform draft into the latest structured Rules state', () => {
    function Harness() {
      const [rules, setRules] = useState<RulesObj>({ transforms: [{ id: 'move', target: { layer: 'Body' }, translate: { x: 1 } }] });
      return <ToastProvider><RulesEditor value={rules} setRules={setRules} layerNames={['Body']} /><output aria-label="Rules state">{JSON.stringify(rules)}</output></ToastProvider>;
    }
    const { getByLabelText, getByRole } = render(<Harness />);
    fireEvent.change(getByLabelText('Transform 1 description'), { target: { value: 'Draft edit' } });
    fireEvent.click(getByRole('button', { name: '+ Add cap' }));
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    const state = JSON.parse(getByLabelText('Rules state').textContent ?? '{}') as RulesObj;
    expect(state.maxOccurrences).toEqual([{ trait: '', max: 1 }]);
    expect(state.transforms?.[0]).toMatchObject({ id: 'move', description: 'Draft edit' });
  });

  it('blocks a dirty whole-Rules JSON draft after a structured edit until Reload', () => {
    function Harness() {
      const [rules, setRules] = useState<RulesObj>({ futureRule: { keep: true } });
      return <ToastProvider><RulesEditor value={rules} setRules={setRules} /><output aria-label="Rules state">{JSON.stringify(rules)}</output></ToastProvider>;
    }
    const { getByLabelText, getByRole } = render(<Harness />);
    fireEvent.change(getByLabelText('Rules JSON'), { target: { value: '{"futureRule":{"draft":true}}' } });
    fireEvent.click(getByRole('button', { name: '+ Add cap' }));
    expect(getByRole('alert').textContent).toMatch(/structured rules changed/i);
    expect((getByRole('button', { name: 'Apply JSON' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Reload Rules JSON' }));
    expect((getByLabelText('Rules JSON') as HTMLTextAreaElement).value).toContain('maxOccurrences');
    const state = JSON.parse(getByLabelText('Rules state').textContent ?? '{}') as RulesObj;
    expect(state.futureRule).toEqual({ keep: true });
    expect(state.maxOccurrences).toEqual([{ trait: '', max: 1 }]);
  });
});
