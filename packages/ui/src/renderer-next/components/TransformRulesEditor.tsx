import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from './Button';
import { Field, Input, Select } from './Field';
import { Panel } from './Panel';
import { TransformPreviewWorkbench } from './TransformPreviewWorkbench';

export interface TraitConditionValue {
  anyOf?: string[];
  allOf?: string[];
  noneOf?: string[];
  not?: TraitConditionValue;
  [key: string]: unknown;
}

export interface TransformRuleValue {
  id?: string;
  description?: string;
  priority?: number;
  when?: TraitConditionValue;
  target?: {
    layer?: string;
    layers?: string[];
    values?: string[];
    filenames?: string[];
    [key: string]: unknown;
  };
  translate?: { x?: number; y?: number; mode?: 'add' | 'set'; [key: string]: unknown };
  rotate?: { degrees?: number; mode?: 'add' | 'set'; [key: string]: unknown };
  scale?: { factor?: number; mode?: 'multiply' | 'set'; [key: string]: unknown };
  [key: string]: unknown;
}

/** A renderer-local view of traits already discovered for the open project. */
export interface TransformTraitCatalogLayer {
  /** Stable catalog identity; layer labels may legitimately repeat. */
  id?: string;
  layer: string;
  path?: string;
  values: string[];
  filenames: string[];
  baseEffects?: {
    offsetX?: number;
    offsetY?: number;
    rotate?: number;
    scale?: number;
    opacity?: number;
    blend?: string;
    glow?: unknown;
    stroke?: unknown;
    shadow?: unknown;
    extrude?: unknown;
    blur?: unknown;
    modulate?: unknown;
    recolor?: unknown;
    colorOverlay?: unknown;
  };
  overrides?: Array<{
    target?: 'filename' | 'value';
    match?: string;
    effects?: TransformTraitCatalogLayer['baseEffects'];
  }>;
}

interface DraftRule {
  editorKey: string;
  value: unknown;
}

const splitList = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const numberOrUndefined = (text: string): number | undefined =>
  text.trim() ? Number(text) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const sourceRules = (value?: TransformRuleValue[]): unknown[] =>
  Array.isArray(value) ? value : [];
const snapshot = (value?: TransformRuleValue[]): string => JSON.stringify(sourceRules(value));
const MAX_SUGGESTIONS = 8;

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function activeToken(
  value: string,
  cursor: number,
  tokenized: boolean,
): { start: number; end: number; query: string } {
  if (!tokenized) return { start: 0, end: value.length, query: value.trim() };
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const start = value.lastIndexOf(',', Math.max(0, safeCursor - 1)) + 1;
  const commaAfter = value.indexOf(',', safeCursor);
  const end = commaAfter === -1 ? value.length : commaAfter;
  return { start, end, query: value.slice(start, end).trim() };
}

function replaceActiveToken(
  value: string,
  cursor: number,
  choice: string,
  tokenized: boolean,
): { value: string; cursor: number } {
  const token = activeToken(value, cursor, tokenized);
  const leadingWhitespace = value.slice(token.start, token.end).match(/^\s*/)?.[0] ?? '';
  const next = `${value.slice(0, token.start)}${leadingWhitespace}${choice}${value.slice(token.end)}`;
  return { value: next, cursor: token.start + leadingWhitespace.length + choice.length };
}

function TraitCombobox({
  value,
  onChange,
  suggestions,
  label,
  placeholder,
  tokenized = false,
}: {
  value: string;
  onChange: (next: string) => string;
  suggestions: string[];
  label: string;
  placeholder?: string;
  tokenized?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId().replaceAll(':', '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [cursor, setCursor] = useState(value.length);
  const [rawValue, setRawValue] = useState(value);
  const lastCommittedValue = useRef(value);
  const query = activeToken(rawValue, cursor, tokenized).query.toLocaleLowerCase();
  const matches = useMemo(
    () =>
      uniqueText(suggestions)
        .filter((suggestion) => suggestion.toLocaleLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS),
    [query, suggestions],
  );
  const listOpen = open && matches.length > 0;
  const activeId =
    activeIndex >= 0 && activeIndex < matches.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(matches.length - 1);
  }, [activeIndex, matches.length]);

  useEffect(() => {
    if (value !== lastCommittedValue.current) {
      lastCommittedValue.current = value;
      setRawValue(value);
      setCursor(value.length);
    }
  }, [value]);

  const syncCursor = (element: HTMLInputElement) =>
    setCursor(element.selectionStart ?? element.value.length);
  const choose = (choice: string) => {
    const next = replaceActiveToken(rawValue, cursor, choice, tokenized);
    setRawValue(next.value);
    lastCommittedValue.current = onChange(next.value);
    setOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
      setCursor(next.cursor);
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(matches.length - 1, Math.max(0, index + 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index <= 0 ? 0 : index - 1));
    } else if (event.key === 'Enter' && listOpen && activeIndex >= 0) {
      event.preventDefault();
      choose(matches[activeIndex]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="trait-combobox">
      <input
        ref={inputRef}
        className="input"
        value={rawValue}
        placeholder={placeholder}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listboxId : undefined}
        aria-activedescendant={activeId}
        onChange={(event) => {
          syncCursor(event.currentTarget);
          setRawValue(event.target.value);
          lastCommittedValue.current = onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          syncCursor(event.currentTarget);
          setOpen(true);
        }}
        onSelect={(event) => syncCursor(event.currentTarget)}
        onClick={(event) => syncCursor(event.currentTarget)}
        onKeyUp={(event) => syncCursor(event.currentTarget)}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {listOpen ? (
        <div
          id={listboxId}
          className="trait-combobox__list"
          role="listbox"
          aria-label={`${label} suggestions`}
        >
          {matches.map((suggestion, index) => (
            <button
              key={suggestion}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-label={suggestion}
              aria-selected={activeIndex === index}
              className={`trait-combobox__option${activeIndex === index ? ' trait-combobox__option--active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                choose(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const MAX_CONDITION_DEPTH = 32;
export const MAX_CONDITION_NODES = 256;

interface ConditionValidationLimits {
  maxDepth: number;
  maxNodes: number;
}

export function validateTraitCondition(
  value: unknown,
  label = 'Condition',
  limits: ConditionValidationLimits = {
    maxDepth: MAX_CONDITION_DEPTH,
    maxNodes: MAX_CONDITION_NODES,
  },
): string[] {
  const errors: string[] = [];
  const pending: Array<{ value: unknown; label: string; depth: number }> = [
    { value, label, depth: 0 },
  ];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > limits.maxNodes) {
      errors.push(`${label} exceeds the ${limits.maxNodes}-node safety limit.`);
      break;
    }
    if (current.depth > limits.maxDepth) {
      errors.push(`${current.label} exceeds the ${limits.maxDepth}-level nesting limit.`);
      continue;
    }
    if (!isRecord(current.value)) {
      errors.push(`${current.label} must be an object.`);
      continue;
    }
    for (const key of ['anyOf', 'allOf', 'noneOf'] as const) {
      if (current.value[key] !== undefined && !stringArray(current.value[key])) {
        errors.push(`${current.label} ${key} must be a list of text values.`);
      }
    }
    if (current.value.not !== undefined) {
      pending.push({
        value: current.value.not,
        label: `${current.label} NOT`,
        depth: current.depth + 1,
      });
    }
  }
  return errors;
}

/** Mirrors the core transform schema constraints without stripping unknown persisted keys. */
export function validateTransformRule(value: unknown): string[] {
  if (!isRecord(value)) return ['Transform rule must be an object.'];
  const rule = value as TransformRuleValue;
  const errors: string[] = [];
  const target = rule.target;
  const hasLayer =
    (typeof target?.layer === 'string' && target.layer.trim().length > 0) ||
    (stringArray(target?.layers) && target.layers.length > 0);
  if (!target || typeof target !== 'object' || Array.isArray(target))
    errors.push('Target must be an object.');
  else {
    if (!hasLayer) errors.push('Target must specify at least one layer.');
    if (target.layer !== undefined && typeof target.layer !== 'string')
      errors.push('Target layer must be text.');
    for (const [name, list] of [
      ['layers', target.layers],
      ['values', target.values],
      ['filenames', target.filenames],
    ] as const) {
      if (list !== undefined && !stringArray(list))
        errors.push(`Target ${name} must be a list of text values.`);
    }
  }
  if (rule.id !== undefined && typeof rule.id !== 'string') errors.push('ID must be text.');
  if (rule.description !== undefined && typeof rule.description !== 'string')
    errors.push('Description must be text.');
  if (rule.priority !== undefined && !finite(rule.priority))
    errors.push('Priority must be a finite number.');
  if (rule.when !== undefined) errors.push(...validateTraitCondition(rule.when, 'When condition'));
  const translate = isRecord(rule.translate) ? rule.translate : undefined;
  const rotate = isRecord(rule.rotate) ? rule.rotate : undefined;
  const scale = isRecord(rule.scale) ? rule.scale : undefined;
  if (rule.translate !== undefined && !translate) errors.push('Translate must be an object.');
  if (rule.rotate !== undefined && !rotate) errors.push('Rotate must be an object.');
  if (rule.scale !== undefined && !scale) errors.push('Scale must be an object.');
  if (!translate && !rotate && !scale) errors.push('Add translate, rotate, or scale.');
  if (translate) {
    if (!finite(translate.x) && !finite(translate.y)) errors.push('Translate must set X or Y.');
    if (translate.x !== undefined && !finite(translate.x))
      errors.push('Translate X must be a finite number.');
    if (translate.y !== undefined && !finite(translate.y))
      errors.push('Translate Y must be a finite number.');
    if (translate.mode !== undefined && translate.mode !== 'add' && translate.mode !== 'set')
      errors.push('Translate mode must be add or set.');
  }
  if (rotate) {
    if (!finite(rotate.degrees)) errors.push('Rotate requires finite degrees.');
    if (rotate.mode !== undefined && rotate.mode !== 'add' && rotate.mode !== 'set')
      errors.push('Rotate mode must be add or set.');
  }
  if (scale) {
    if (!finite(scale.factor) || scale.factor <= 0)
      errors.push('Scale factor must be greater than zero.');
    if (scale.mode !== undefined && scale.mode !== 'multiply' && scale.mode !== 'set')
      errors.push('Scale mode must be multiply or set.');
  }
  return errors;
}

export function validateTransformRules(rules: unknown[]): Record<number, string[]> {
  return Object.fromEntries(rules.map((rule, index) => [index, validateTransformRule(rule)]));
}

function editableCondition(value: unknown): TraitConditionValue | undefined {
  if (!isRecord(value)) return undefined;
  const next = { ...value } as TraitConditionValue;
  for (const key of ['anyOf', 'allOf', 'noneOf'] as const) {
    if (!stringArray(next[key])) delete next[key];
  }
  if (!isRecord(next.not)) delete next.not;
  return next;
}

function editableTransformRule(value: unknown): TransformRuleValue {
  if (!isRecord(value)) return {};
  const next = { ...value } as TransformRuleValue;
  next.target = isRecord(value.target) ? { ...value.target } : {};
  const when = editableCondition(value.when);
  if (when) next.when = when;
  else delete next.when;
  if (isRecord(value.translate)) next.translate = { ...value.translate };
  else delete next.translate;
  if (isRecord(value.rotate)) next.rotate = { ...value.rotate };
  else delete next.rotate;
  if (isRecord(value.scale)) next.scale = { ...value.scale };
  else delete next.scale;
  return next;
}

function ConditionEditor({
  label,
  value,
  onChange,
  traitChoices,
  depth = 0,
}: {
  label: string;
  value?: TraitConditionValue;
  onChange: (value: TraitConditionValue | undefined) => void;
  traitChoices: string[];
  depth?: number;
}) {
  const condition = editableCondition(value) ?? {};
  const nestedUnsafe = condition.not
    ? validateTraitCondition(condition.not, `${label} NOT`).some(
        (error) => error.includes('safety limit') || error.includes('nesting limit'),
      )
    : false;
  const changeList = (key: 'anyOf' | 'allOf' | 'noneOf', text: string): string => {
    const next = { ...condition };
    const list = splitList(text);
    if (list.length) next[key] = list;
    else delete next[key];
    onChange(next);
    return list.join(', ');
  };
  return (
    <fieldset className="stack editor-fieldset">
      <legend className="label">{label}</legend>
      <div className="grid cols-auto">
        <Field label="Any of">
          <TraitCombobox
            value={(condition.anyOf ?? []).join(', ')}
            onChange={(text) => changeList('anyOf', text)}
            suggestions={traitChoices}
            label={`${label} any of`}
            tokenized
          />
        </Field>
        <Field label="All of">
          <TraitCombobox
            value={(condition.allOf ?? []).join(', ')}
            onChange={(text) => changeList('allOf', text)}
            suggestions={traitChoices}
            label={`${label} all of`}
            tokenized
          />
        </Field>
        <Field label="None of">
          <TraitCombobox
            value={(condition.noneOf ?? []).join(', ')}
            onChange={(text) => changeList('noneOf', text)}
            suggestions={traitChoices}
            label={`${label} none of`}
            tokenized
          />
        </Field>
      </div>
      {condition.not ? (
        <div className="stack editor-nested">
          {depth < 5 ? (
            <ConditionEditor
              label={`${label} NOT`}
              value={condition.not}
              traitChoices={traitChoices}
              depth={depth + 1}
              onChange={(not) => {
                const next = { ...condition };
                if (not) next.not = not;
                else delete next.not;
                onChange(next);
              }}
            />
          ) : nestedUnsafe ? (
            <div className="banner-error" role="alert">
              This NOT condition exceeds the safe editor nesting limit. Replace it through the whole
              Rules JSON editor.
            </div>
          ) : (
            <ConditionJsonFallback
              label={`${label} NOT (JSON)`}
              value={condition.not}
              onChange={(not) => {
                const next = { ...condition };
                if (not) next.not = not;
                else delete next.not;
                onChange(next);
              }}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const next = { ...condition };
              delete next.not;
              onChange(next);
            }}
          >
            Remove NOT
          </Button>
        </div>
      ) : depth < 5 ? (
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...condition, not: {} })}>
          + Add NOT
        </Button>
      ) : null}
      {Object.keys(condition).length ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
          Clear condition
        </Button>
      ) : null}
    </fieldset>
  );
}

function ConditionJsonFallback({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TraitConditionValue;
  onChange: (next: TraitConditionValue | undefined) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    try {
      const next: unknown = JSON.parse(text);
      const errors = validateTraitCondition(next);
      if (errors.length) throw new Error(errors.join(' '));
      onChange(next as TraitConditionValue);
      setError(null);
    } catch (cause) {
      setError(String((cause as Error).message));
    }
  };
  return (
    <div className="stack">
      <Field label={label}>
        <textarea
          className="textarea"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={label}
        />
      </Field>
      <div className="row">
        <Button size="sm" onClick={apply}>
          Apply condition JSON
        </Button>
        {error ? (
          <span className="field-msg field-msg--error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

let transformSequence = 0;
function nextTransformId(): string {
  transformSequence += 1;
  return `transform-${Date.now().toString(36)}-${transformSequence.toString(36)}`;
}

function nextEditorKey(): string {
  transformSequence += 1;
  return `transform-row-${Date.now().toString(36)}-${transformSequence.toString(36)}`;
}

function newRule(layer?: string): TransformRuleValue {
  return {
    id: nextTransformId(),
    description: '',
    priority: 0,
    target: { layer: layer ?? '' },
    translate: { x: 0, y: 0, mode: 'add' },
  };
}

function makeDraft(value?: TransformRuleValue[]): DraftRule[] {
  return structuredClone(sourceRules(value)).map((rule) => ({
    editorKey: nextEditorKey(),
    value: rule,
  }));
}

export function TransformRulesEditor({
  value,
  onChange,
  layerNames = [],
  traitCatalog = [],
  imageWidth = 1024,
  imageHeight = 1024,
  projectScope = '',
}: {
  value?: TransformRuleValue[];
  onChange: (next: TransformRuleValue[]) => void;
  layerNames?: string[];
  traitCatalog?: TransformTraitCatalogLayer[];
  imageWidth?: number;
  imageHeight?: number;
  projectScope?: string;
}) {
  const sourceSnapshot = snapshot(value);
  const [baselineSnapshot, setBaselineSnapshot] = useState(sourceSnapshot);
  const [baselineScope, setBaselineScope] = useState(projectScope);
  const [draft, setDraft] = useState<DraftRule[]>(() => makeDraft(value));
  const [dirty, setDirty] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(() => draft[0]?.editorKey ?? null);
  const disclosurePrefix = useId().replaceAll(':', '');
  const sourceChanged = dirty && sourceSnapshot !== baselineSnapshot;
  const scopeChanged = projectScope !== baselineScope;
  const errors = useMemo(() => validateTransformRules(draft.map((row) => row.value)), [draft]);
  const hasErrors = Object.values(errors).some((items) => items.length > 0);

  const reload = () => {
    const next = makeDraft(value);
    setDraft(next);
    setOpenKey(next[0]?.editorKey ?? null);
    setBaselineSnapshot(sourceSnapshot);
    setBaselineScope(projectScope);
    setDirty(false);
  };

  useEffect(() => {
    if (scopeChanged || (!dirty && sourceSnapshot !== baselineSnapshot)) reload();
    // Reload tracks the project scope as well as the serialized source so same-shaped projects
    // cannot inherit an unsaved transform draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectScope, scopeChanged, sourceSnapshot, baselineSnapshot, dirty]);

  const update = (editorKey: string, recipe: (rule: TransformRuleValue) => TransformRuleValue) => {
    setDraft((current) =>
      current.map((row) =>
        row.editorKey === editorKey
          ? { ...row, value: recipe(editableTransformRule(row.value)) }
          : row,
      ),
    );
    setDirty(true);
  };
  const updateTargetList = (
    editorKey: string,
    key: 'layers' | 'values' | 'filenames',
    text: string,
  ): string => {
    const list = splitList(text);
    update(editorKey, (current) => ({ ...current, target: { ...current.target, [key]: list } }));
    return list.join(', ');
  };
  const updatePrimaryLayer = (editorKey: string, text: string): string => {
    update(editorKey, (current) => ({ ...current, target: { ...current.target, layer: text || undefined } }));
    return text;
  };
  const remove = (editorKey: string) => {
    setDraft((current) => current.filter((row) => row.editorKey !== editorKey));
    setOpenKey((current) => (current === editorKey ? null : current));
    setDirty(true);
  };
  const duplicate = (editorKey: string) => {
    setDraft((current) => {
      const index = current.findIndex((row) => row.editorKey === editorKey);
      if (index < 0) return current;
      const copy = {
        editorKey: nextEditorKey(),
        value: {
          ...structuredClone(editableTransformRule(current[index]!.value)),
          id: nextTransformId(),
        },
      };
      setOpenKey((open) => (open === null || open === editorKey ? copy.editorKey : open));
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setDirty(true);
  };
  const setAction = (
    editorKey: string,
    action: 'translate' | 'rotate' | 'scale',
    enabled: boolean,
  ) =>
    update(editorKey, (rule) => {
      const next = { ...rule };
      if (!enabled) delete next[action];
      else if (action === 'translate') next.translate = { x: 0, y: 0, mode: 'add' };
      else if (action === 'rotate') next.rotate = { degrees: 0, mode: 'add' };
      else next.scale = { factor: 1, mode: 'multiply' };
      return next;
    });
  const apply = () => {
    if (hasErrors || sourceChanged || scopeChanged) return;
    const next = structuredClone(draft.map((row) => row.value)) as TransformRuleValue[];
    onChange(next);
    const committed = makeDraft(next);
    setDraft(committed);
    setOpenKey(committed[0]?.editorKey ?? null);
    setBaselineSnapshot(JSON.stringify(next));
    setDirty(false);
  };

  return (
    <Panel
      title="Transforms"
      actions={
        <div className="row wrap">
          <Button size="sm" variant="ghost" onClick={reload}>
            Reload
          </Button>
          <Button size="sm" variant="ghost" onClick={reload} disabled={!dirty}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply} disabled={!dirty || hasErrors || sourceChanged || scopeChanged}>
            Apply transforms
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const row = { editorKey: nextEditorKey(), value: newRule(layerNames[0]) };
              setDraft((current) => [...current, row]);
              setOpenKey(row.editorKey);
              setDirty(true);
            }}
          >
            + Add transform
          </Button>
        </div>
      }
    >
      <div className="stack">
        <span className="label muted">
          Edit a private draft, then Apply. Invalid drafts never reach the project config; unknown
          imported keys remain unchanged.
        </span>
        {sourceChanged ? (
          <div className="banner-error" role="alert">
            Transforms changed outside this draft. Reload to review the latest project state before
            applying.
          </div>
        ) : null}
        {dirty && hasErrors ? (
          <div className="banner-error" role="alert">
            Fix all transform issues before applying.
          </div>
        ) : null}
        {!draft.length ? <span className="label muted">No transform rules yet.</span> : null}
        {draft.map((row, index) => {
          const rule = editableTransformRule(row.value);
          const contentId = `${disclosurePrefix}-${row.editorKey}`;
          const selectedLayers = uniqueText([
            rule.target?.layer ?? '',
            ...(stringArray(rule.target?.layers) ? rule.target.layers : []),
          ]);
          const scopedCatalog = selectedLayers.length
            ? traitCatalog.filter((entry) => selectedLayers.includes(entry.layer))
            : traitCatalog;
          const targetValues = uniqueText(scopedCatalog.flatMap((entry) => entry.values));
          const targetFilenames = uniqueText(scopedCatalog.flatMap((entry) => entry.filenames));
          const traitChoices = uniqueText(
            traitCatalog.flatMap((entry) => entry.values.map((value) => `${entry.layer}:${value}`)),
          );
          return (
            <section key={row.editorKey} className="stack editor-card">
              <div className="row spread wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenKey(openKey === row.editorKey ? null : row.editorKey)}
                  aria-expanded={openKey === row.editorKey}
                  aria-controls={contentId}
                >
                  {openKey === row.editorKey ? 'Hide' : 'Edit'} ·{' '}
                  {rule.description || rule.id || `Transform ${index + 1}`}
                </Button>
                <div className="row wrap">
                  <span
                    className={errors[index]?.length ? 'field-msg field-msg--error' : 'label muted'}
                  >
                    {errors[index]?.length
                      ? `${errors[index].length} issue${errors[index].length === 1 ? '' : 's'}`
                      : 'valid'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => duplicate(row.editorKey)}
                    aria-label={`Duplicate transform ${index + 1}`}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => remove(row.editorKey)}
                    aria-label={`Delete transform ${index + 1}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {openKey === row.editorKey ? (
                <div id={contentId} className="stack">
                  {errors[index]?.length ? (
                    <div className="banner-error" role="alert">
                      {errors[index].join(' ')}
                    </div>
                  ) : null}
                  <div className="grid cols-auto">
                    <Field label="ID">
                      <Input
                        value={rule.id ?? ''}
                        onChange={(event) =>
                          update(row.editorKey, (current) => ({
                            ...current,
                            id: event.target.value,
                          }))
                        }
                        aria-label={`Transform ${index + 1} ID`}
                      />
                    </Field>
                    <Field label="Description">
                      <Input
                        value={rule.description ?? ''}
                        onChange={(event) =>
                          update(row.editorKey, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        aria-label={`Transform ${index + 1} description`}
                      />
                    </Field>
                    <Field label="Priority">
                      <Input
                        type="number"
                        value={rule.priority ?? ''}
                        onChange={(event) =>
                          update(row.editorKey, (current) => ({
                            ...current,
                            priority: numberOrUndefined(event.target.value),
                          }))
                        }
                        aria-label={`Transform ${index + 1} priority`}
                      />
                    </Field>
                  </div>
                  <fieldset className="stack editor-fieldset">
                    <legend className="label">Transform {index + 1} target</legend>
                    <div className="grid cols-auto">
                      <Field label="Primary layer">
                        <TraitCombobox
                          value={rule.target?.layer ?? ''}
                          onChange={(text) => updatePrimaryLayer(row.editorKey, text)}
                          suggestions={layerNames}
                          label={`Transform ${index + 1} primary layer`}
                          placeholder="Select or type a layer"
                        />
                      </Field>
                      <Field label="Additional layers">
                        <TraitCombobox
                          value={(rule.target?.layers ?? []).join(', ')}
                          onChange={(text) => updateTargetList(row.editorKey, 'layers', text)}
                          suggestions={layerNames}
                          label={`Transform ${index + 1} additional layers`}
                          tokenized
                        />
                      </Field>
                      <Field label="Values">
                        <TraitCombobox
                          value={(rule.target?.values ?? []).join(', ')}
                          onChange={(text) => updateTargetList(row.editorKey, 'values', text)}
                          suggestions={targetValues}
                          label={`Transform ${index + 1} values`}
                          tokenized
                        />
                      </Field>
                      <Field label="Filenames">
                        <TraitCombobox
                          value={(rule.target?.filenames ?? []).join(', ')}
                          onChange={(text) => updateTargetList(row.editorKey, 'filenames', text)}
                          suggestions={targetFilenames}
                          label={`Transform ${index + 1} filenames`}
                          tokenized
                        />
                      </Field>
                    </div>
                  </fieldset>
                  {traitCatalog.some((entry) => entry.path) ? <TransformPreviewWorkbench rule={rule} rules={draft.map((draftRule) => draftRule.value as TransformRuleValue)} traitCatalog={traitCatalog} imageWidth={imageWidth} imageHeight={imageHeight} projectScope={projectScope} onTranslateChange={(x, y) => update(row.editorKey, (current) => ({ ...current, translate: { ...current.translate, x, y, mode: current.translate?.mode ?? 'add' } }))} /> : null}
                  <ConditionEditor
                    label={`Transform ${index + 1} when traits match`}
                    value={rule.when}
                    traitChoices={traitChoices}
                    onChange={(when) =>
                      update(row.editorKey, (current) => {
                        const next = { ...current };
                        if (when) next.when = when;
                        else delete next.when;
                        return next;
                      })
                    }
                  />
                  <div className="grid cols-auto">
                    <fieldset className="stack editor-fieldset">
                      <legend className="label">Transform {index + 1} translate</legend>
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={!!rule.translate}
                          onChange={(event) =>
                            setAction(row.editorKey, 'translate', event.target.checked)
                          }
                          aria-label={`Transform ${index + 1} enable translate`}
                        />{' '}
                        <span className="label">Enable</span>
                      </label>
                      {rule.translate ? (
                        <div className="grid cols-auto">
                          <Field label="X">
                            <Input
                              type="number"
                              value={rule.translate.x ?? ''}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  translate: {
                                    ...current.translate,
                                    x: numberOrUndefined(event.target.value),
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} translate X`}
                            />
                          </Field>
                          <Field label="Y">
                            <Input
                              type="number"
                              value={rule.translate.y ?? ''}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  translate: {
                                    ...current.translate,
                                    y: numberOrUndefined(event.target.value),
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} translate Y`}
                            />
                          </Field>
                          <Field label="Mode">
                            <Select
                              value={rule.translate.mode ?? 'add'}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  translate: {
                                    ...current.translate,
                                    mode: event.target.value as 'add' | 'set',
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} translate mode`}
                            >
                              <option value="add">add</option>
                              <option value="set">set</option>
                            </Select>
                          </Field>
                        </div>
                      ) : null}
                    </fieldset>
                    <fieldset className="stack editor-fieldset">
                      <legend className="label">Transform {index + 1} rotate</legend>
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={!!rule.rotate}
                          onChange={(event) =>
                            setAction(row.editorKey, 'rotate', event.target.checked)
                          }
                          aria-label={`Transform ${index + 1} enable rotate`}
                        />{' '}
                        <span className="label">Enable</span>
                      </label>
                      {rule.rotate ? (
                        <div className="grid cols-auto">
                          <Field label="Degrees">
                            <Input
                              type="number"
                              value={rule.rotate.degrees ?? ''}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  rotate: {
                                    ...current.rotate,
                                    degrees: numberOrUndefined(event.target.value),
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} rotate degrees`}
                            />
                          </Field>
                          <Field label="Mode">
                            <Select
                              value={rule.rotate.mode ?? 'add'}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  rotate: {
                                    ...current.rotate,
                                    mode: event.target.value as 'add' | 'set',
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} rotate mode`}
                            >
                              <option value="add">add</option>
                              <option value="set">set</option>
                            </Select>
                          </Field>
                        </div>
                      ) : null}
                    </fieldset>
                    <fieldset className="stack editor-fieldset">
                      <legend className="label">Transform {index + 1} scale</legend>
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={!!rule.scale}
                          onChange={(event) =>
                            setAction(row.editorKey, 'scale', event.target.checked)
                          }
                          aria-label={`Transform ${index + 1} enable scale`}
                        />{' '}
                        <span className="label">Enable</span>
                      </label>
                      {rule.scale ? (
                        <div className="grid cols-auto">
                          <Field label="Factor">
                            <Input
                              type="number"
                              min="0.001"
                              step="0.01"
                              value={rule.scale.factor ?? ''}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  scale: {
                                    ...current.scale,
                                    factor: numberOrUndefined(event.target.value),
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} scale factor`}
                            />
                          </Field>
                          <Field label="Mode">
                            <Select
                              value={rule.scale.mode ?? 'multiply'}
                              onChange={(event) =>
                                update(row.editorKey, (current) => ({
                                  ...current,
                                  scale: {
                                    ...current.scale,
                                    mode: event.target.value as 'multiply' | 'set',
                                  },
                                }))
                              }
                              aria-label={`Transform ${index + 1} scale mode`}
                            >
                              <option value="multiply">multiply</option>
                              <option value="set">set</option>
                            </Select>
                          </Field>
                        </div>
                      ) : null}
                    </fieldset>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
