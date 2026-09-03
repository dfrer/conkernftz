import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Field, Input, Select } from './Field';
import { Panel } from './Panel';
import { validateTraitCondition } from './TransformRulesEditor';
import type { LayerCfg } from '../state/project';

export type LayerConditionValue = { anyOf?: string[]; allOf?: string[]; noneOf?: string[]; not?: LayerConditionValue; [key: string]: unknown };
export type LayerOptionRuleValue = { match?: { target?: 'value' | 'filename'; pattern?: string; [key: string]: unknown }; when?: LayerConditionValue; unless?: LayerConditionValue; exclude?: boolean; weightMultiply?: number; [key: string]: unknown };
export interface LayerAdvancedRulesValue {
  spawnWhenAnyOf?: string[];
  spawnWhen?: LayerConditionValue;
  spawnUnless?: LayerConditionValue;
  optionRules?: LayerOptionRuleValue[];
}

const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function editableOptionRule(value: unknown): LayerOptionRuleValue {
  if (!isRecord(value)) return {};
  const next = { ...value } as LayerOptionRuleValue;
  next.match = isRecord(value.match) ? { ...value.match } : {};
  if (!isRecord(value.when)) delete next.when;
  if (!isRecord(value.unless)) delete next.unless;
  return next;
}

export function validateLayerAdvancedRules(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Advanced conditional settings must be an object.'];
  const parsed = value as Record<string, unknown>;
  const errors: string[] = [];
  const allowedKeys = new Set(['spawnWhenAnyOf', 'spawnWhen', 'spawnUnless', 'optionRules']);
  const unknownKeys = Object.keys(parsed).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) errors.push(`Unsupported layer fields: ${unknownKeys.join(', ')}.`);
  if (parsed.spawnWhenAnyOf != null && !stringArray(parsed.spawnWhenAnyOf)) errors.push('spawnWhenAnyOf must be a list of text values.');
  if (parsed.spawnWhen != null) errors.push(...validateTraitCondition(parsed.spawnWhen, 'spawnWhen'));
  if (parsed.spawnUnless != null) errors.push(...validateTraitCondition(parsed.spawnUnless, 'spawnUnless'));
  if (parsed.optionRules != null) {
    if (!Array.isArray(parsed.optionRules)) errors.push('optionRules must be a list.');
    else parsed.optionRules.forEach((candidate, index) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push(`Option rule ${index + 1} must be an object.`);
        return;
      }
      const rule = candidate as LayerOptionRuleValue;
      if (!rule.match || typeof rule.match !== 'object' || Array.isArray(rule.match)) errors.push(`Option rule ${index + 1} requires a match object.`);
      else {
        if (rule.match.target !== 'value' && rule.match.target !== 'filename') errors.push(`Option rule ${index + 1} match target must be value or filename.`);
        if (typeof rule.match.pattern !== 'string') errors.push(`Option rule ${index + 1} match pattern must be text.`);
      }
      if (rule.when != null) errors.push(...validateTraitCondition(rule.when, `Option rule ${index + 1} when`));
      if (rule.unless != null) errors.push(...validateTraitCondition(rule.unless, `Option rule ${index + 1} unless`));
      if (rule.exclude != null && typeof rule.exclude !== 'boolean') errors.push(`Option rule ${index + 1} exclude must be true or false.`);
      if (rule.weightMultiply != null && (typeof rule.weightMultiply !== 'number' || !Number.isFinite(rule.weightMultiply) || rule.weightMultiply <= 0)) errors.push(`Option rule ${index + 1} weightMultiply must be a finite number greater than zero.`);
    });
  }
  return errors;
}

function ConditionInputs({ label, namePrefix, value, onChange }: { label: string; namePrefix: string; value?: LayerConditionValue; onChange: (next: LayerConditionValue | undefined) => void }) {
  const condition = isRecord(value) ? value as LayerConditionValue : {};
  const update = (key: 'anyOf' | 'allOf' | 'noneOf', text: string) => {
    const next = { ...condition };
    const items = split(text);
    if (items.length) next[key] = items;
    else delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return <fieldset className="stack editor-fieldset"><legend className="label">{label}</legend><div className="grid cols-auto"><Field label="Any of"><Input value={(condition.anyOf ?? []).join(', ')} onChange={(event) => update('anyOf', event.target.value)} aria-label={`${namePrefix} any of`} /></Field><Field label="All of"><Input value={(condition.allOf ?? []).join(', ')} onChange={(event) => update('allOf', event.target.value)} aria-label={`${namePrefix} all of`} /></Field><Field label="None of"><Input value={(condition.noneOf ?? []).join(', ')} onChange={(event) => update('noneOf', event.target.value)} aria-label={`${namePrefix} none of`} /></Field></div></fieldset>;
}

/** Local generation gates. This only mutates validated conditional fields on the selected layer. */
export function LayerRulesEditor({ layer, onChange }: { layer: LayerCfg; onChange: (patch: Partial<LayerCfg>) => void }) {
  const optionRules = Array.isArray(layer.optionRules) ? layer.optionRules as unknown[] : [];
  const advancedValue = JSON.stringify({ spawnWhenAnyOf: layer.spawnWhenAnyOf, spawnWhen: layer.spawnWhen, spawnUnless: layer.spawnUnless, optionRules }, null, 2);
  const [advancedJson, setAdvancedJson] = useState(advancedValue);
  const [advancedBaseline, setAdvancedBaseline] = useState(advancedValue);
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [weightErrors, setWeightErrors] = useState<Record<number, string>>({});
  const advancedSourceChanged = advancedDirty && advancedValue !== advancedBaseline;

  const reloadAdvanced = () => {
    setAdvancedJson(advancedValue);
    setAdvancedBaseline(advancedValue);
    setAdvancedDirty(false);
    setAdvancedError(null);
  };
  useEffect(() => {
    if (!advancedDirty && advancedValue !== advancedBaseline) reloadAdvanced();
    // Track semantic JSON state, not cloned layer object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedValue, advancedBaseline, advancedDirty]);

  const setOptionRules = (next: unknown[]) => onChange({ optionRules: next });
  const updateRule = (index: number, update: (rule: LayerOptionRuleValue) => LayerOptionRuleValue) => setOptionRules(optionRules.map((rule, current) => current === index ? update(editableOptionRule(rule)) : rule));
  const setCondition = (index: number, key: 'when' | 'unless', value: LayerConditionValue | undefined) => updateRule(index, (rule) => { const next = { ...rule }; if (value) next[key] = value; else delete next[key]; return next; });
  const updateWeight = (index: number, text: string) => {
    if (text === '') {
      setWeightErrors((current) => { const next = { ...current }; delete next[index]; return next; });
      updateRule(index, (current) => ({ ...current, weightMultiply: undefined, exclude: false }));
      return;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) {
      setWeightErrors((current) => ({ ...current, [index]: 'Weight multiply must be greater than zero.' }));
      return;
    }
    setWeightErrors((current) => { const next = { ...current }; delete next[index]; return next; });
    updateRule(index, (current) => ({ ...current, weightMultiply: value, exclude: false }));
  };
  const applyAdvanced = () => {
    if (advancedSourceChanged) return;
    try {
      const parsed: unknown = JSON.parse(advancedJson);
      const errors = validateLayerAdvancedRules(parsed);
      if (errors.length) throw new Error(errors.join(' '));
      const next = parsed as LayerAdvancedRulesValue;
      onChange({
        spawnWhenAnyOf: next.spawnWhenAnyOf,
        spawnWhen: next.spawnWhen,
        spawnUnless: next.spawnUnless,
        optionRules: next.optionRules,
      });
      setAdvancedBaseline(JSON.stringify(next, null, 2));
      setAdvancedDirty(false);
      setAdvancedError(null);
    } catch (cause) { setAdvancedError(String((cause as Error).message)); }
  };

  return <Panel title={`Conditional generation — ${layer.name}`}>
    <div className="stack">
      <span className="label muted">Gate a layer or alter a matching option after earlier traits are chosen. Traits use the <code>Layer:Value</code> format.</span>
      <Field label="Spawn when any of"><Input value={Array.isArray(layer.spawnWhenAnyOf) ? layer.spawnWhenAnyOf.join(', ') : ''} onChange={(event) => onChange({ spawnWhenAnyOf: split(event.target.value) })} placeholder="Body:Robot, Background:Night" aria-label={`${layer.name} spawn when any selected trait`} /></Field>
      <ConditionInputs label="Spawn when" namePrefix={`${layer.name} spawn when`} value={layer.spawnWhen as LayerConditionValue | undefined} onChange={(spawnWhen) => onChange({ spawnWhen })} />
      <ConditionInputs label="Spawn unless" namePrefix={`${layer.name} spawn unless`} value={layer.spawnUnless as LayerConditionValue | undefined} onChange={(spawnUnless) => onChange({ spawnUnless })} />
      <div className="row spread"><span className="label">Option rules</span><Button size="sm" onClick={() => setOptionRules([...optionRules, { match: { target: 'value', pattern: '' } }])}>+ Add option rule</Button></div>
      {optionRules.map((candidate, index) => {
        const rule = editableOptionRule(candidate);
        return <section key={index} className="stack editor-card">
        <div className="grid cols-auto"><Field label="Match target"><Select value={rule.match?.target ?? 'value'} onChange={(event) => updateRule(index, (current) => ({ ...current, match: { ...current.match, target: event.target.value as 'value' | 'filename' } }))} aria-label={`Option rule ${index + 1} match target`}><option value="value">value</option><option value="filename">filename</option></Select></Field><Field label="Exact pattern"><Input value={rule.match?.pattern ?? ''} onChange={(event) => updateRule(index, (current) => ({ ...current, match: { ...current.match, pattern: event.target.value } }))} aria-label={`Option rule ${index + 1} exact pattern`} /></Field></div>
        <ConditionInputs label="When" namePrefix={`Option rule ${index + 1} when`} value={rule.when} onChange={(next) => setCondition(index, 'when', next)} />
        <ConditionInputs label="Unless" namePrefix={`Option rule ${index + 1} unless`} value={rule.unless} onChange={(next) => setCondition(index, 'unless', next)} />
        <div className="grid cols-auto"><label className="row"><input type="checkbox" checked={!!rule.exclude} onChange={(event) => updateRule(index, (current) => ({ ...current, exclude: event.target.checked, ...(event.target.checked ? { weightMultiply: undefined } : {}) }))} aria-label={`Option rule ${index + 1} exclude option`} /> <span className="label">Exclude option</span></label><Field label="Weight multiply" error={weightErrors[index]}><Input type="number" min="0.001" step="0.1" disabled={!!rule.exclude} value={rule.weightMultiply ?? ''} onChange={(event) => updateWeight(index, event.target.value)} aria-label={`Option rule ${index + 1} weight multiply`} /></Field><div className="self-end"><Button size="sm" variant="danger" onClick={() => { setOptionRules(optionRules.filter((_, current) => current !== index)); setWeightErrors({}); }} aria-label={`Delete option rule ${index + 1}`}>Delete rule</Button></div></div>
      </section>;
      })}
      <fieldset className="stack editor-fieldset"><legend className="label">Advanced conditional JSON</legend><span className="label muted">Use for imported recursive conditions or option-rule fields not represented above. Apply changes only validated conditional fields on this layer.</span><textarea className="textarea" rows={7} spellCheck={false} value={advancedJson} onChange={(event) => { setAdvancedJson(event.target.value); setAdvancedDirty(true); }} aria-label="Advanced conditional JSON" />{advancedSourceChanged ? <div className="banner-error" role="alert">Structured conditional settings changed after this JSON draft began. Reload before applying.</div> : null}<div className="row wrap"><Button size="sm" variant="ghost" onClick={reloadAdvanced}>Reload JSON</Button><Button size="sm" variant="ghost" onClick={reloadAdvanced} disabled={!advancedDirty}>Cancel JSON</Button><Button size="sm" onClick={applyAdvanced} disabled={!advancedDirty || advancedSourceChanged}>Apply conditional JSON</Button>{advancedError ? <span className="field-msg field-msg--error" role="alert">{advancedError}</span> : null}</div></fieldset>
    </div>
  </Panel>;
}
