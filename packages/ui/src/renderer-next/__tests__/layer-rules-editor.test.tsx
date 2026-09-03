import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LayerRulesEditor, validateLayerAdvancedRules } from '../components/LayerRulesEditor';
import type { LayerCfg } from '../state/project';

afterEach(cleanup);

function mount(initial: LayerCfg) {
  const onChange = vi.fn();
  function Harness() {
    const [layer, setLayer] = useState(initial);
    return <LayerRulesEditor layer={layer} onChange={(patch) => { onChange(patch); setLayer((current) => ({ ...current, ...patch })); }} />;
  }
  return { ...render(<Harness />), onChange };
}

describe('LayerRulesEditor', () => {
  it('matches core conditional and option-rule validation', () => {
    expect(validateLayerAdvancedRules({
      spawnWhen: { anyOf: [3] },
      optionRules: [{ match: { target: 'bad' }, weightMultiply: Number.POSITIVE_INFINITY }],
    })).toEqual(expect.arrayContaining([
      'spawnWhen anyOf must be a list of text values.',
      'Option rule 1 match target must be value or filename.',
      'Option rule 1 match pattern must be text.',
      'Option rule 1 weightMultiply must be a finite number greater than zero.',
    ]));
    expect(validateLayerAdvancedRules({ optionRules: [null] })).toContain('Option rule 1 must be an object.');
  });

  it('renders malformed imported option rules without dereferencing null', () => {
    const { getByRole, getByLabelText, onChange } = mount({ name: 'Body', path: 'layers/body', optionRules: [null, { match: null }] });
    expect(getByLabelText('Option rule 1 exact pattern')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Apply conditional JSON' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not propagate nonpositive or nonfinite weight multipliers', () => {
    const { getByLabelText, getByRole, onChange } = mount({ name: 'Body', path: 'layers/body', optionRules: [{ match: { target: 'value', pattern: 'Robot' }, weightMultiply: 2 }] });
    fireEvent.change(getByLabelText('Option rule 1 weight multiply'), { target: { value: '0' } });
    expect(getByRole('alert').textContent).toMatch(/greater than zero/i);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(getByLabelText('Option rule 1 weight multiply'), { target: { value: 'Infinity' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects malformed advanced JSON before onChange', () => {
    const { getByLabelText, getByRole, onChange } = mount({ name: 'Body', path: 'layers/body' });
    fireEvent.change(getByLabelText('Advanced conditional JSON'), { target: { value: '{"spawnWhen":{"anyOf":[7]}}' } });
    fireEvent.click(getByRole('button', { name: 'Apply conditional JSON' }));
    expect(getByRole('alert').textContent).toMatch(/must be a list of text values/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('warns and blocks stale advanced JSON after a structured edit until Reload', () => {
    const { getByLabelText, getByRole, onChange } = mount({ name: 'Body', path: 'layers/body' });
    fireEvent.change(getByLabelText('Advanced conditional JSON'), { target: { value: '{"spawnWhenAnyOf":["Eyes:Open"],"optionRules":[]}' } });
    fireEvent.change(getByLabelText('Body spawn when any selected trait'), { target: { value: 'Hat:Crown' } });
    expect(onChange).toHaveBeenCalledWith({ spawnWhenAnyOf: ['Hat:Crown'] });
    expect(getByRole('alert').textContent).toMatch(/reload before applying/i);
    expect((getByRole('button', { name: 'Apply conditional JSON' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Reload JSON' }));
    expect((getByLabelText('Advanced conditional JSON') as HTMLTextAreaElement).value).toContain('Hat:Crown');
  });

  it('gives repeated option-rule condition controls unique accessible names', () => {
    const { getByLabelText } = mount({ name: 'Body', path: 'layers/body', optionRules: [
      { match: { target: 'value', pattern: 'One' } },
      { match: { target: 'value', pattern: 'Two' } },
    ] });
    expect(getByLabelText('Option rule 1 when any of')).toBeTruthy();
    expect(getByLabelText('Option rule 2 unless none of')).toBeTruthy();
  });
});
