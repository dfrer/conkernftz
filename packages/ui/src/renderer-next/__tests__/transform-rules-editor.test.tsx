import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  TransformRulesEditor,
  validateTraitCondition,
  validateTransformRule,
  type TraitConditionValue,
  type TransformRuleValue,
} from '../components/TransformRulesEditor';

function mount(value: TransformRuleValue[]) {
  const onChange = vi.fn();
  const traitCatalog = [
    { layer: 'Body', values: ['Tilted', 'Robot'], filenames: ['Tilted#1.png', 'Robot#2.png'] },
    { layer: 'Eyes', values: ['Laser', 'Open'], filenames: ['Laser#1.png', 'Open#1.png'] },
  ];
  function Harness() {
    const [rules, setRules] = useState(value);
    return (
      <TransformRulesEditor
        value={rules}
        onChange={(next) => {
          onChange(next);
          setRules(next);
        }}
        layerNames={['Body', 'Eyes']}
        traitCatalog={traitCatalog}
      />
    );
  }
  return { ...render(<Harness />), onChange };
}

const orientation: TransformRuleValue = {
  id: 'orientation',
  description: 'Tilt the tilted body',
  priority: 3,
  unknownRuleKey: { keep: true },
  target: {
    layer: 'Body',
    values: ['Tilted'],
    filenames: ['Tilted#1.png'],
    unknownTargetKey: 'keep',
  },
  when: {
    anyOf: ['Eyes:Laser'],
    allOf: ['Body:Tilted'],
    noneOf: ['Hat:Heavy'],
    not: { anyOf: ['Mood:Sleepy'], unknownConditionKey: 'keep' },
  },
  translate: { x: 12, y: -4, mode: 'set' },
  rotate: { degrees: 15, mode: 'add' },
  scale: { factor: 1.2, mode: 'multiply' },
};

afterEach(cleanup);

describe('TransformRulesEditor', () => {
  it('mirrors core schema feedback for malformed imported conditions, modes, and targets', () => {
    expect(
      validateTransformRule({
        when: { anyOf: [3] as unknown as string[] },
        target: { layers: ['Body', 3] as unknown as string[] },
        rotate: { degrees: 3, mode: 'bad' as never },
        scale: { factor: 0, mode: 'wrong' as never },
      }),
    ).toEqual(
      expect.arrayContaining([
        'When condition anyOf must be a list of text values.',
        'Target layers must be a list of text values.',
        'Rotate mode must be add or set.',
        'Scale factor must be greater than zero.',
        'Scale mode must be multiply or set.',
      ]),
    );
    expect(validateTransformRule(null)).toContain('Transform rule must be an object.');
  });

  it('bounds adversarial recursive NOT validation by depth and node count', () => {
    let nested: TraitConditionValue = {};
    for (let index = 0; index < 8; index += 1) nested = { not: nested };
    expect(
      validateTraitCondition(nested, 'Condition', { maxDepth: 3, maxNodes: 100 }).join(' '),
    ).toMatch(/3-level nesting limit/);
    expect(
      validateTraitCondition(nested, 'Condition', { maxDepth: 100, maxNodes: 3 }).join(' '),
    ).toMatch(/3-node safety limit/);
  });

  it('renders malformed imported transform entries without dereferencing null', () => {
    const malformed = [
      null,
      { target: null, translate: null, when: { not: null } },
    ] as unknown as TransformRuleValue[];
    const { getByRole, getAllByText, onChange } = mount(malformed);
    expect(getAllByText(/issue/).length).toBeGreaterThan(0);
    expect((getByRole('button', { name: 'Apply transforms' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps edits private until explicit Apply and preserves unknown data', () => {
    const { getByLabelText, getByRole, onChange } = mount([orientation]);
    fireEvent.change(getByLabelText('Transform 1 ID'), { target: { value: 'orientation-v2' } });
    fireEvent.change(getByLabelText('Transform 1 primary layer'), { target: { value: 'Eyes' } });
    fireEvent.change(getByLabelText('Transform 1 translate X'), { target: { value: '8' } });
    fireEvent.change(getByLabelText('Transform 1 when traits match NOT any of'), {
      target: { value: 'Mood:Alert' },
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'orientation-v2',
        unknownRuleKey: { keep: true },
        target: expect.objectContaining({ layer: 'Eyes', unknownTargetKey: 'keep' }),
        translate: expect.objectContaining({ x: 8 }),
        when: expect.objectContaining({
          not: expect.objectContaining({ anyOf: ['Mood:Alert'], unknownConditionKey: 'keep' }),
        }),
      }),
    ]);
  });

  it('never propagates an invalid draft and Cancel restores the project value', () => {
    const { getByLabelText, getByRole, onChange } = mount([orientation]);
    fireEvent.change(getByLabelText('Transform 1 scale factor'), { target: { value: '0' } });
    expect((getByRole('button', { name: 'Apply transforms' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect((getByLabelText('Transform 1 scale factor') as HTMLInputElement).value).toBe('1.2');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds and duplicates with new IDs, then applies the coherent draft once', () => {
    const { getByRole, getAllByRole, onChange } = mount([orientation]);
    fireEvent.click(getByRole('button', { name: '+ Add transform' }));
    fireEvent.click(getByRole('button', { name: 'Duplicate transform 1' }));
    fireEvent.click(getAllByRole('button', { name: /Delete transform/ })[2]!);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    const applied = onChange.mock.calls[0]![0] as TransformRuleValue[];
    expect(applied).toHaveLength(2);
    expect(applied[1]).toMatchObject({
      description: orientation.description,
      unknownRuleKey: { keep: true },
      target: orientation.target,
    });
    expect(applied[1]!.id).not.toBe(orientation.id);
  });

  it('keeps deep-NOT JSON draft state attached to the same rule when an earlier row is duplicated', () => {
    let deep: TraitConditionValue = { anyOf: ['Mood:Calm'], unknown: 'keep' };
    for (let index = 0; index < 6; index += 1) deep = { not: deep };
    const second = { id: 'deep', target: { layer: 'Body' }, translate: { x: 1 }, when: deep };
    const { getByRole, getByLabelText } = mount([orientation, second]);
    fireEvent.click(getByRole('button', { name: /Edit · deep/ }));
    const input = getByLabelText(/Transform 2.*JSON/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"allOf":["Eyes:Open"],"futureKey":true}' } });
    fireEvent.click(getByRole('button', { name: 'Duplicate transform 1' }));
    expect((getByLabelText(/Transform 3.*JSON/) as HTMLTextAreaElement).value).toBe(
      '{"allOf":["Eyes:Open"],"futureKey":true}',
    );
  });

  it('blocks stale transform drafts until Reload and exposes disclosure relationships', () => {
    const onChange = vi.fn();
    function Harness() {
      const [rules, setRules] = useState([orientation]);
      return (
        <>
          <button onClick={() => setRules([{ ...orientation, priority: 99 }])}>
            External update
          </button>
          <TransformRulesEditor value={rules} onChange={onChange} layerNames={['Body']} />
        </>
      );
    }
    const { getByRole, getByLabelText } = render(<Harness />);
    const disclosure = getByRole('button', { name: /Hide · Tilt the tilted body/ });
    expect(disclosure.getAttribute('aria-controls')).toBeTruthy();
    fireEvent.change(getByLabelText('Transform 1 ID'), { target: { value: 'draft' } });
    fireEvent.click(getByRole('button', { name: 'External update' }));
    expect(getByRole('alert').textContent).toMatch(/changed outside this draft/i);
    expect((getByRole('button', { name: 'Apply transforms' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(getByRole('button', { name: 'Reload' }));
    expect((getByLabelText('Transform 1 priority') as HTMLInputElement).value).toBe('99');
  });

  it('drops a private draft when the project scope changes even if transforms serialize identically', () => {
    const onChange = vi.fn();
    const source = [{ ...orientation, id: 'project-source' }];
    const { getByLabelText, getByRole, rerender } = render(
      <TransformRulesEditor value={source} onChange={onChange} layerNames={['Body']} projectScope="project-a" />,
    );
    fireEvent.change(getByLabelText('Transform 1 ID'), { target: { value: 'project-a-draft' } });
    expect((getByRole('button', { name: 'Apply transforms' }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<TransformRulesEditor value={source} onChange={onChange} layerNames={['Body']} projectScope="project-b" />);
    expect((getByLabelText('Transform 1 ID') as HTMLInputElement).value).toBe('project-source');
    expect((getByRole('button', { name: 'Apply transforms' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters project suggestions, supports keyboard selection, and keeps custom primary layers editable', () => {
    const { getByLabelText, getByRole, queryByRole, onChange } = mount([orientation]);
    const primary = getByLabelText('Transform 1 primary layer') as HTMLInputElement;
    fireEvent.focus(primary);
    fireEvent.change(primary, { target: { value: 'Ey' } });
    expect(getByRole('option', { name: 'Eyes' })).toBeTruthy();
    expect(queryByRole('option', { name: 'Body' })).toBeNull();
    fireEvent.keyDown(primary, { key: 'ArrowDown' });
    fireEvent.keyDown(primary, { key: 'Enter' });
    expect(primary.value).toBe('Eyes');
    fireEvent.change(primary, { target: { value: 'Archive-only' } });
    expect(primary.value).toBe('Archive-only');
    fireEvent.change(primary, { target: { value: 'Bo' } });
    fireEvent.click(getByRole('option', { name: 'Body' }));
    expect(primary.value).toBe('Body');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces only the active comma token in trait conditions and additional layers', () => {
    const { getByLabelText } = mount([orientation]);
    const anyOf = getByLabelText('Transform 1 when traits match any of') as HTMLInputElement;
    fireEvent.change(anyOf, { target: { value: 'Eyes:Laser, Bo' } });
    fireEvent.keyDown(anyOf, { key: 'ArrowDown' });
    fireEvent.keyDown(anyOf, { key: 'Enter' });
    expect(anyOf.value).toBe('Eyes:Laser, Body:Tilted');

    const layers = getByLabelText('Transform 1 additional layers') as HTMLInputElement;
    fireEvent.change(layers, { target: { value: 'Body, Ey' } });
    fireEvent.keyDown(layers, { key: 'ArrowDown' });
    fireEvent.keyDown(layers, { key: 'Enter' });
    expect(layers.value).toBe('Body, Eyes');
  });

  it('keeps sequential raw token text through Apply while committing normalized arrays', () => {
    const { getByLabelText, getByRole, onChange } = mount([orientation]);
    const layers = getByLabelText('Transform 1 additional layers') as HTMLInputElement;
    let typed = '';
    for (const character of 'Body, ') {
      typed += character;
      fireEvent.change(layers, { target: { value: typed } });
      expect(layers.value).toBe(typed);
    }
    fireEvent.click(getByRole('button', { name: 'Apply transforms' }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ target: expect.objectContaining({ layers: ['Body'] }) }),
    ]);
    expect((getByLabelText('Transform 1 additional layers') as HTMLInputElement).value).toBe('Body');
  });

  it('keeps options out of the tab order, closes on Tab/blur, and accepts click activation once', () => {
    const { getByLabelText, getByRole, queryByRole } = mount([orientation]);
    const primary = getByLabelText('Transform 1 primary layer') as HTMLInputElement;
    fireEvent.focus(primary);
    expect([...getByRole('listbox').querySelectorAll('[role="option"]')].every((option) => option.getAttribute('tabindex') === '-1')).toBe(true);
    fireEvent.keyDown(primary, { key: 'Tab' });
    fireEvent.blur(primary);
    expect(queryByRole('listbox')).toBeNull();
    fireEvent.focus(primary);
    fireEvent.change(primary, { target: { value: '' } });
    fireEvent.click(getByRole('option', { name: 'Eyes' }));
    expect(primary.value).toBe('Eyes');
  });

  it('scopes target values and filenames to selected layers and falls back to the catalog', () => {
    const { getByLabelText, getByRole, queryByRole, rerender } = mount([orientation]);
    const values = getByLabelText('Transform 1 values') as HTMLInputElement;
    fireEvent.change(values, { target: { value: '' } });
    fireEvent.focus(values);
    expect(getByRole('option', { name: 'Robot' })).toBeTruthy();
    expect(queryByRole('option', { name: 'Laser' })).toBeNull();
    const filenames = getByLabelText('Transform 1 filenames') as HTMLInputElement;
    fireEvent.change(filenames, { target: { value: '' } });
    fireEvent.focus(filenames);
    expect(getByRole('option', { name: 'Robot#2.png' })).toBeTruthy();
    expect(queryByRole('option', { name: 'Laser#1.png' })).toBeNull();

    rerender(
      <TransformRulesEditor
        value={[{ target: {}, translate: { x: 1 } }]}
        onChange={vi.fn()}
        layerNames={['Body', 'Eyes']}
        traitCatalog={[
          {
            layer: 'Body',
            values: ['Tilted', 'Robot'],
            filenames: ['Tilted#1.png', 'Robot#2.png'],
          },
          { layer: 'Eyes', values: ['Laser', 'Open'], filenames: ['Laser#1.png', 'Open#1.png'] },
        ]}
      />,
    );
    const fallbackValues = getByLabelText('Transform 1 values');
    fireEvent.focus(fallbackValues);
    expect(getByRole('option', { name: 'Laser' })).toBeTruthy();
  });
});
