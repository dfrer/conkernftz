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

  it('edits a max-occurrences trait', () => {
    const { getByLabelText, setRules } = mount({ maxOccurrences: [{ trait: 'X', max: 2 }] });
    fireEvent.change(getByLabelText('Max occurrence trait 1'), { target: { value: 'Background:Gold' } });
    expect(setRules).toHaveBeenCalledWith(
      expect.objectContaining({ maxOccurrences: [{ trait: 'Background:Gold', max: 2 }] }),
    );
  });

  it('applies advanced JSON, replacing the rules object', () => {
    const { getByLabelText, getByRole, setRules } = mount({});
    fireEvent.change(getByLabelText('Rules JSON'), { target: { value: '{"maxOccurrences":[{"trait":"A","max":3}]}' } });
    fireEvent.click(getByRole('button', { name: 'Apply JSON' }));
    expect(setRules).toHaveBeenCalledWith({ maxOccurrences: [{ trait: 'A', max: 3 }] });
  });
});
