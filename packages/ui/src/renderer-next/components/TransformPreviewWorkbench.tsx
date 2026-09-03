import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './Button';
import { Field, Select } from './Field';
import { bridge } from '../lib/bridge';
import type { TraitConditionValue, TransformRuleValue, TransformTraitCatalogLayer } from './TransformRulesEditor';

export interface PreviewRuleState {
  active: boolean;
  reason: string;
}

type PreviewEffects = NonNullable<TransformTraitCatalogLayer['baseEffects']>;
type EffectiveTransform = { x: number; y: number; rotate: number; scale: number; opacity: number; effects: PreviewEffects };
type SampleFiles = Record<string, string>;
type SampleMatch = { samples: SampleFiles; matchable: boolean; reason: string };
const MAX_CONDITION_DEPTH = 32;
const MAX_AUTOMATCH_CANDIDATES = 512;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const entryId = (entry: TransformTraitCatalogLayer, index: number) => entry.id ?? `${index}\0${entry.path ?? ''}\0${entry.layer}`;
const entryValue = (entry: TransformTraitCatalogLayer, filename: string) => entry.values[entry.filenames.indexOf(filename)] ?? filename;

function traitPair(trait: string) {
  const split = trait.indexOf(':');
  return split < 0 ? { layer: '', value: trait } : { layer: trait.slice(0, split), value: trait.slice(split + 1) };
}

function matchesTrait(trait: string, sample: Record<string, string>) {
  const pair = traitPair(trait);
  return !!pair.layer && sample[pair.layer] === pair.value;
}

function conditionList(condition: Record<string, unknown>, key: 'anyOf' | 'allOf' | 'noneOf') {
  if (!(key in condition) || condition[key] === undefined) return { ok: true as const, values: undefined };
  const value = condition[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return { ok: false as const, values: undefined };
  return { ok: true as const, values: value as string[] };
}

function conditionState(condition: TraitConditionValue | undefined, sample: Record<string, string>, depth = 0): PreviewRuleState {
  if (condition === undefined) return { active: true, reason: 'No condition — this sample activates the rule.' };
  if (!isRecord(condition) || depth > MAX_CONDITION_DEPTH) return { active: false, reason: 'Invalid condition — preview unavailable.' };
  const any = conditionList(condition, 'anyOf');
  const all = conditionList(condition, 'allOf');
  const none = conditionList(condition, 'noneOf');
  if (!any.ok || !all.ok || !none.ok) return { active: false, reason: 'Invalid condition — preview unavailable.' };
  if (any.values?.length && !any.values.some((trait) => matchesTrait(trait, sample))) return { active: false, reason: `Any of needs ${any.values.join(' or ')}.` };
  if (all.values?.length && !all.values.every((trait) => matchesTrait(trait, sample))) return { active: false, reason: `All of needs ${all.values.join(', ')}.` };
  if (none.values?.some((trait) => matchesTrait(trait, sample))) return { active: false, reason: `None of excludes ${none.values.find((trait) => matchesTrait(trait, sample))}.` };
  if ('not' in condition && condition.not !== undefined) {
    const nested = conditionState(condition.not as TraitConditionValue, sample, depth + 1);
    if (nested.reason === 'Invalid condition — preview unavailable.') return nested;
    if (nested.active) return { active: false, reason: 'NOT condition matches this sample.' };
  }
  return { active: true, reason: 'Selected sample traits satisfy the condition.' };
}

function targetState(rule: TransformRuleValue, sample: Record<string, string>, affectedLayer: string, filename: string, value = sample[affectedLayer] ?? ''): PreviewRuleState {
  if (!isRecord(rule.target)) return { active: false, reason: 'Invalid target — preview unavailable.' };
  const target = rule.target;
  const names: string[] = [];
  if (target.layer !== undefined) {
    if (typeof target.layer !== 'string') return { active: false, reason: 'Invalid target — preview unavailable.' };
    if (target.layer.trim()) names.push(target.layer);
  }
  if (target.layers !== undefined) {
    if (!Array.isArray(target.layers) || !target.layers.every((name) => typeof name === 'string')) return { active: false, reason: 'Invalid target — preview unavailable.' };
    names.push(...target.layers.filter((name) => name.trim()));
  }
  if (!names.length) return { active: false, reason: 'No target layer — preview inactive.' };
  if (!names.includes(affectedLayer)) return { active: false, reason: `Target layers do not include ${affectedLayer || 'this layer'}.` };
  if (target.values !== undefined) {
    if (!Array.isArray(target.values) || !target.values.every((item) => typeof item === 'string')) return { active: false, reason: 'Invalid target values — preview unavailable.' };
    if (target.values.length && !target.values.includes(value)) return { active: false, reason: `Target values exclude ${value || 'this asset'}.` };
  }
  if (target.filenames !== undefined) {
    if (!Array.isArray(target.filenames) || !target.filenames.every((item) => typeof item === 'string')) return { active: false, reason: 'Invalid target filenames — preview unavailable.' };
    const filenames = target.filenames.filter(Boolean);
    if (filenames.length && !filenames.some((name) => name.toLowerCase() === filename.toLowerCase())) return { active: false, reason: `Target filenames exclude ${filename || 'this asset'}.` };
  }
  return { active: true, reason: 'Selected sample traits match and satisfy the condition and target filters.' };
}

export function explainTransformPreview(rule: TransformRuleValue, sample: Record<string, string>, affectedLayer: string, filename: string): PreviewRuleState {
  if (!isRecord(rule)) return { active: false, reason: 'Invalid rule — preview unavailable.' };
  const condition = conditionState(rule.when, sample);
  return condition.active ? targetState(rule, sample, affectedLayer, filename) : condition;
}

function ruleStateForEntry(rule: TransformRuleValue, sample: Record<string, string>, entry: TransformTraitCatalogLayer, filename: string): PreviewRuleState {
  const condition = conditionState(rule.when, sample);
  return condition.active ? targetState(rule, sample, entry.layer, filename, entryValue(entry, filename)) : condition;
}

function selectedLayers(rule: TransformRuleValue, catalog: TransformTraitCatalogLayer[]) {
  if (!isRecord(rule.target)) return [];
  const names = [rule.target.layer, ...(Array.isArray(rule.target.layers) ? rule.target.layers : [])].filter((name): name is string => typeof name === 'string' && !!name.trim());
  return names.length ? catalog.filter((entry) => names.includes(entry.layer)) : [];
}

function initialSamples(catalog: TransformTraitCatalogLayer[]): SampleFiles {
  return Object.fromEntries(catalog.map((entry, index) => [entryId(entry, index), entry.filenames[0] ?? '']));
}

function sameSamples(left: SampleFiles, right: SampleFiles) {
  const leftKeys = Object.keys(left);
  return leftKeys.length === Object.keys(right).length && leftKeys.every((key) => left[key] === right[key]);
}

function samplesAreValidForCatalog(catalog: TransformTraitCatalogLayer[], samples: SampleFiles) {
  return catalog.every((entry, index) => {
    const filenames = entry.filenames.filter(Boolean);
    const selected = samples[entryId(entry, index)] ?? '';
    return filenames.length ? filenames.includes(selected) : selected === '';
  });
}

function sampleTraitsForFiles(catalog: TransformTraitCatalogLayer[], samples: SampleFiles) {
  return Object.fromEntries(catalog.map((entry, index) => [entry.layer, entryValue(entry, samples[entryId(entry, index)] ?? '')]));
}

function catalogEntryForLayer(catalog: TransformTraitCatalogLayer[], layer: string) {
  for (let index = catalog.length - 1; index >= 0; index -= 1) {
    const entry = catalog[index];
    if (entry?.layer === layer) return { entry, index };
  }
  return undefined;
}

type SampleDimension = { entry: TransformTraitCatalogLayer; index: number; filenames: string[] };

function referencedConditionTraits(condition: TraitConditionValue | undefined, traits: string[] = [], depth = 0): string[] {
  if (condition === undefined || !isRecord(condition) || depth > MAX_CONDITION_DEPTH) return traits;
  for (const key of ['anyOf', 'allOf', 'noneOf'] as const) {
    const list = conditionList(condition, key);
    if (list.ok) traits.push(...(list.values ?? []));
  }
  if (condition.not !== undefined) referencedConditionTraits(condition.not as TraitConditionValue, traits, depth + 1);
  return traits;
}

function availableFiles(entry: TransformTraitCatalogLayer, filter?: (filename: string, index: number) => boolean) {
  const files: string[] = [];
  entry.filenames.forEach((filename, index) => { if (filename && (!filter || filter(filename, index))) files.push(filename); });
  return files;
}

function traitIsAvailable(catalog: TransformTraitCatalogLayer[], trait: string) {
  const found = catalogEntryForLayer(catalog, traitPair(trait).layer);
  return !!found && found.entry.values.some((value, index) => value === traitPair(trait).value && !!found.entry.filenames[index]);
}

function unavailableRequiredTrait(condition: TraitConditionValue | undefined, catalog: TransformTraitCatalogLayer[], depth = 0): string | undefined {
  if (condition === undefined || !isRecord(condition) || depth > MAX_CONDITION_DEPTH) return undefined;
  const all = conditionList(condition, 'allOf');
  if (all.ok) {
    const missing = all.values?.find((trait) => !traitIsAvailable(catalog, trait));
    if (missing) return missing;
  }
  const any = conditionList(condition, 'anyOf');
  if (any.ok && any.values?.length && any.values.every((trait) => !traitIsAvailable(catalog, trait))) return any.values.join(' or ');
  return condition.not === undefined ? undefined : unavailableRequiredTrait(condition.not as TraitConditionValue, catalog, depth + 1);
}

function unavailableMatchReason(rule: TransformRuleValue, catalog: TransformTraitCatalogLayer[], affected: TransformTraitCatalogLayer, defaults: SampleFiles) {
  const missing = unavailableRequiredTrait(rule.when, catalog);
  if (missing) return `Unavailable ${missing}.`;
  const state = ruleStateForEntry(rule, sampleTraitsForFiles(catalog, defaults), affected, defaults[entryId(affected, catalog.indexOf(affected))] ?? '');
  return `No deterministic match: ${state.reason}`;
}

export function matchTransformPreviewSample(rule: TransformRuleValue, catalog: TransformTraitCatalogLayer[], affected?: TransformTraitCatalogLayer): SampleMatch {
  const defaults = initialSamples(catalog);
  if (!affected) return { samples: defaults, matchable: false, reason: 'No target layer is available for this rule.' };
  const affectedIndex = catalog.indexOf(affected);
  if (affectedIndex < 0 || !isRecord(rule.target)) return { samples: defaults, matchable: false, reason: 'Invalid target — preview unavailable.' };
  const target = rule.target;
  const values = target.values;
  const filenames = target.filenames;
  if ((values !== undefined && (!Array.isArray(values) || !values.every((value) => typeof value === 'string'))) || (filenames !== undefined && (!Array.isArray(filenames) || !filenames.every((filename) => typeof filename === 'string')))) return { samples: defaults, matchable: false, reason: 'Invalid target filters — preview unavailable.' };
  const initialState = conditionState(rule.when, sampleTraitsForFiles(catalog, defaults));
  if (initialState.reason === 'Invalid condition — preview unavailable.') return { samples: defaults, matchable: false, reason: initialState.reason };
  const requiredValues = values ?? [];
  const requiredFilenames = (filenames ?? []).filter(Boolean).map((filename) => filename.toLowerCase());
  const targetFiles = availableFiles(affected, (filename, index) => (!requiredValues.length || requiredValues.includes(affected.values[index] ?? filename)) && (!requiredFilenames.length || requiredFilenames.includes(filename.toLowerCase())));
  if (!targetFiles.length) {
    const missingValue = requiredValues[0];
    const missing = requiredFilenames[0] ?? (missingValue === undefined ? affected.layer : `${affected.layer}:${missingValue || '(empty)'}`);
    return { samples: defaults, matchable: false, reason: `Unavailable target ${missing}.` };
  }
  const dimensions: SampleDimension[] = [{ entry: affected, index: affectedIndex, filenames: targetFiles }];
  const seen = new Set([entryId(affected, affectedIndex)]);
  for (const trait of referencedConditionTraits(rule.when)) {
    const found = catalogEntryForLayer(catalog, traitPair(trait).layer);
    if (!found) continue;
    const id = entryId(found.entry, found.index);
    if (!seen.has(id)) {
      seen.add(id);
      dimensions.push({ ...found, filenames: availableFiles(found.entry) });
    }
  }
  if (dimensions.some((dimension) => !dimension.filenames.length)) return { samples: defaults, matchable: false, reason: unavailableMatchReason(rule, catalog, affected, defaults) };
  let evaluated = 0;
  let exhausted = false;
  let matched: SampleFiles | undefined;
  const search = (position: number, samples: SampleFiles): void => {
    if (matched || exhausted) return;
    if (position === dimensions.length) {
      if (evaluated >= MAX_AUTOMATCH_CANDIDATES) {
        exhausted = true;
        return;
      }
      evaluated += 1;
      const filename = samples[entryId(affected, affectedIndex)] ?? '';
      if (ruleStateForEntry(rule, sampleTraitsForFiles(catalog, samples), affected, filename).active) matched = samples;
      return;
    }
    const dimension = dimensions[position];
    if (!dimension) return;
    for (const filename of dimension.filenames) search(position + 1, { ...samples, [entryId(dimension.entry, dimension.index)]: filename });
  };
  search(0, defaults);
  if (matched) return { samples: matched, matchable: true, reason: 'Rule-matching sample selected.' };
  if (exhausted) return { samples: defaults, matchable: false, reason: 'Automatic matching limit reached; choose sample traits manually.' };
  return { samples: defaults, matchable: false, reason: unavailableMatchReason(rule, catalog, affected, defaults) };
}

function resolveEffects(entry: TransformTraitCatalogLayer, filename: string): PreviewEffects {
  const value = entryValue(entry, filename);
  const base = { ...(entry.baseEffects ?? {}) };
  for (const override of entry.overrides ?? []) {
    if (!override?.match || !override.effects) continue;
    const matches = override.target === 'filename' ? filename === override.match : value === override.match;
    if (matches) return { ...base, ...override.effects };
  }
  return base;
}

function baseTransform(entry: TransformTraitCatalogLayer, filename: string): EffectiveTransform {
  const effects = resolveEffects(entry, filename);
  return {
    x: finite(effects.offsetX) ? Math.round(effects.offsetX) : 0,
    y: finite(effects.offsetY) ? Math.round(effects.offsetY) : 0,
    rotate: finite(effects.rotate) ? effects.rotate : 0,
    scale: finite(effects.scale) ? effects.scale : 1,
    opacity: finite(effects.opacity) ? Math.max(0, Math.min(1, effects.opacity)) : 1,
    effects,
  };
}

function applyRuleTransform(transform: EffectiveTransform, rule: TransformRuleValue) {
  const next = { ...transform };
  const translate = isRecord(rule.translate) ? rule.translate : undefined;
  if (translate) {
    const mode = translate.mode === 'set' ? 'set' : 'add';
    if (finite(translate.x)) next.x = mode === 'set' ? translate.x : next.x + translate.x;
    if (finite(translate.y)) next.y = mode === 'set' ? translate.y : next.y + translate.y;
  }
  const rotate = isRecord(rule.rotate) ? rule.rotate : undefined;
  if (rotate && finite(rotate.degrees)) next.rotate = rotate.mode === 'set' ? rotate.degrees : next.rotate + rotate.degrees;
  const scale = isRecord(rule.scale) ? rule.scale : undefined;
  if (scale && finite(scale.factor) && scale.factor > 0) {
    const factor = Math.max(0.001, scale.factor);
    next.scale = Math.max(0.001, scale.mode === 'set' ? factor : next.scale * factor);
  }
  return next;
}

function effectiveTransform(entry: TransformTraitCatalogLayer, filename: string, sample: Record<string, string>, rules: TransformRuleValue[]) {
  const sorted = rules
    .map((rule, index) => ({ rule, index }))
    .filter((item): item is { rule: TransformRuleValue; index: number } => isRecord(item.rule))
    .map((item) => ({ ...item, priority: finite(item.rule.priority) ? item.rule.priority : 0 }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);
  return sorted.reduce((transform, item) => ruleStateForEntry(item.rule, sample, entry, filename).active ? applyRuleTransform(transform, item.rule) : transform, baseTransform(entry, filename));
}

function hasUnpreviewedEffects(effects: PreviewEffects) {
  return !!(effects.blend && effects.blend !== 'normal') || ['glow', 'stroke', 'shadow', 'extrude', 'blur', 'modulate', 'recolor', 'colorOverlay'].some((key) => effects[key as keyof PreviewEffects] !== undefined);
}

function transformedLayer(id: string, image: string, transform: EffectiveTransform, width: number, height: number, affected: boolean) {
  const scale = finite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const radians = ((finite(transform.rotate) ? transform.rotate : 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians)) < 1e-10 ? 0 : Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians)) < 1e-10 ? 0 : Math.abs(Math.sin(radians));
  const expandedWidth = Math.max(1, Math.round((scaledWidth * cos) + (scaledHeight * sin)));
  const expandedHeight = Math.max(1, Math.round((scaledWidth * sin) + (scaledHeight * cos)));
  const x = (expandedWidth - scaledWidth) / 2;
  const y = (expandedHeight - scaledHeight) / 2;
  return <g key={id} transform={`translate(${Math.round(transform.x)} ${Math.round(transform.y)}) rotate(${transform.rotate} ${expandedWidth / 2} ${expandedHeight / 2})`}>
    <image className={affected ? 'transform-preview__asset transform-preview__asset--affected' : 'transform-preview__asset'} href={image} x={x} y={y} width={scaledWidth} height={scaledHeight} opacity={transform.opacity} preserveAspectRatio="none" />
  </g>;
}

export function TransformPreviewWorkbench({ rule, rules, traitCatalog, imageWidth, imageHeight, projectScope = '', onTranslateChange }: {
  rule: TransformRuleValue;
  rules?: TransformRuleValue[];
  traitCatalog: TransformTraitCatalogLayer[];
  imageWidth: number;
  imageHeight: number;
  projectScope?: string;
  onTranslateChange: (x: number, y: number) => void;
}) {
  const targets = useMemo(() => selectedLayers(rule, traitCatalog), [rule, traitCatalog]);
  const [samples, setSamples] = useState<SampleFiles>(() => matchTransformPreviewSample(rule, traitCatalog, targets[0]).samples);
  const [sampleLayerId, setSampleLayerId] = useState(() => entryId(traitCatalog[0] ?? { layer: '', values: [], filenames: [] }, 0));
  const [affectedLayerId, setAffectedLayerId] = useState(() => entryId(targets[0] ?? { layer: '', values: [], filenames: [] }, 0));
  const [matchNote, setMatchNote] = useState(() => matchTransformPreviewSample(rule, traitCatalog, targets[0]).reason);
  const [hasManualSamples, setHasManualSamples] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [assetsReady, setAssetsReady] = useState(false);
  const canvasRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; baseX: number; baseY: number } | null>(null);
  const loadVersion = useRef(0);
  const catalogKey = traitCatalog.map((entry, index) => `${entryId(entry, index)}\0${entry.path ?? ''}\0${entry.values.join('|')}\0${entry.filenames.join('|')}`).join('\n');
  const ruleKey = JSON.stringify({ target: rule.target, when: rule.when });
  const matchingScope = `${projectScope}\0${catalogKey}\0${ruleKey}`;
  const affected = targets.find((entry) => entryId(entry, traitCatalog.indexOf(entry)) === affectedLayerId) ?? targets[0];
  const previousProjectScope = useRef(projectScope);

  useEffect(() => {
    const first = traitCatalog[0];
    if (!traitCatalog.some((entry, index) => entryId(entry, index) === sampleLayerId)) setSampleLayerId(first ? entryId(first, 0) : '');
    if (!targets.some((entry, index) => entryId(entry, traitCatalog.indexOf(entry)) === affectedLayerId)) setAffectedLayerId(targets[0] ? entryId(targets[0], traitCatalog.indexOf(targets[0])) : '');
  }, [catalogKey, sampleLayerId, affectedLayerId, targets, traitCatalog]);

  useEffect(() => {
    const projectChanged = previousProjectScope.current !== projectScope;
    previousProjectScope.current = projectScope;
    const match = matchTransformPreviewSample(rule, traitCatalog, affected);
    if (projectChanged || !hasManualSamples || !samplesAreValidForCatalog(traitCatalog, samples)) {
      setSamples((current) => sameSamples(current, match.samples) ? current : match.samples);
      setMatchNote(match.reason);
      setHasManualSamples(false);
    }
  }, [matchingScope, projectScope, affected, hasManualSamples, samples, traitCatalog, rule]);

  const assetScope = `${projectScope}\0${catalogKey}\0${traitCatalog.map((entry, index) => samples[entryId(entry, index)] ?? '').join('|')}`;
  useLayoutEffect(() => {
    loadVersion.current += 1;
    setImages({});
    setAssetsReady(false);
  }, [assetScope]);

  useEffect(() => {
    const version = loadVersion.current;
    const fb = bridge();
    if (!fb) {
      setAssetsReady(true);
      return;
    }
    void Promise.all(traitCatalog.map(async (entry, index) => {
      const id = entryId(entry, index);
      const file = samples[id] ?? entry.filenames[0];
      if (!file || !entry.path) return [id, ''] as const;
      const result = await fb.readFileBase64(`${entry.path.replace(/[\\/]+$/, '')}/${file}`);
      return [id, result.ok && result.base64 ? `data:${result.mime || 'image/png'};base64,${result.base64}` : ''] as const;
    })).then((loaded) => {
      if (loadVersion.current === version) {
        setImages(Object.fromEntries(loaded));
        setAssetsReady(true);
      }
    }).catch(() => {
      if (loadVersion.current === version) {
        setImages({});
        setAssetsReady(true);
      }
    });
  }, [assetScope, samples, traitCatalog]);

  const sampleEntry = traitCatalog.find((entry, index) => entryId(entry, index) === sampleLayerId);
  const sampleTraits = useMemo(() => sampleTraitsForFiles(traitCatalog, samples), [samples, traitCatalog]);
  const state = affected ? ruleStateForEntry(rule, sampleTraits, affected, samples[entryId(affected, traitCatalog.indexOf(affected))] ?? '') : { active: false, reason: 'No matching target layer — preview inactive.' };
  const allRules = rules?.length ? rules : [rule];
  const transforms = useMemo(() => Object.fromEntries(traitCatalog.map((entry, index) => {
    const id = entryId(entry, index);
    return [id, effectiveTransform(entry, samples[id] ?? '', sampleTraits, allRules)];
  })), [allRules, sampleTraits, samples, traitCatalog]);
  const x = finite(rule.translate?.x) ? rule.translate.x : 0;
  const y = finite(rule.translate?.y) ? rule.translate.y : 0;
  const safeWidth = Math.max(1, finite(imageWidth) ? imageWidth : 1);
  const safeHeight = Math.max(1, finite(imageHeight) ? imageHeight : 1);
  const stageWidth = safeWidth >= safeHeight ? 720 : Math.max(1, Math.round(Math.min(720, safeWidth * Math.min(1, 560 / safeHeight))));
  const hasVisualLimit = traitCatalog.some((entry, index) => hasUnpreviewedEffects((transforms[entryId(entry, index)] as EffectiveTransform | undefined)?.effects ?? {}));
  const status = state.active ? state : { ...state, reason: matchNote || state.reason };

  const move = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect || !rect.width || !rect.height) return;
    onTranslateChange(Math.round(drag.baseX + ((clientX - drag.x) * safeWidth) / rect.width), Math.round(drag.baseY + ((clientY - drag.y) * safeHeight) / rect.height));
  };
  const stopDrag = (event: { pointerId: number }) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!state.active || !affected) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, baseX: x, baseY: y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!state.active) return;
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const next = delta[event.key];
    if (!next) return;
    event.preventDefault();
    onTranslateChange(x + next[0], y + next[1]);
  };

  const layerLabel = (entry: TransformTraitCatalogLayer, index: number) => {
    const sameName = traitCatalog.filter((candidate) => candidate.layer === entry.layer);
    if (sameName.length < 2) return entry.layer;
    const path = entry.path || `layer ${index + 1}`;
    const exactDuplicates = sameName.filter((candidate) => (candidate.path || '') === (entry.path || ''));
    const suffix = exactDuplicates.length > 1 ? ` (${exactDuplicates.indexOf(entry) + 1})` : '';
    return `${entry.layer} — ${path}${suffix}`;
  };

  return <section className="transform-preview" aria-label="Transform draft preview">
    <div className="row spread wrap"><span className="label">Deterministic sample preview</span><span className={state.active ? 'badge badge--ok' : 'badge badge--warn'}>{state.active ? 'active' : 'inactive'}</span></div>
    <div className="grid cols-auto transform-preview__controls">
      <Field label="Affected layer"><Select value={affectedLayerId} onChange={(event) => setAffectedLayerId(event.target.value)} aria-label="Preview affected layer">{targets.map((entry) => { const index = traitCatalog.indexOf(entry); return <option key={entryId(entry, index)} value={entryId(entry, index)}>{layerLabel(entry, index)}</option>; })}</Select></Field>
      <Field label="Sample layer"><Select value={sampleLayerId} onChange={(event) => { setHasManualSamples(true); setSampleLayerId(event.target.value); }} aria-label="Preview sample layer">{traitCatalog.map((entry, index) => <option key={entryId(entry, index)} value={entryId(entry, index)}>{layerLabel(entry, index)}</option>)}</Select></Field>
      <Field label="Sample asset"><Select value={samples[sampleLayerId] ?? ''} onChange={(event) => { setImages({}); setMatchNote(''); setHasManualSamples(true); setSamples((current) => ({ ...current, [sampleLayerId]: event.target.value })); }} aria-label="Preview sample asset">{sampleEntry?.filenames.map((file, index) => <option key={file} value={file}>{sampleEntry.values[index] ?? file} · {file}</option>)}</Select></Field>
    </div>
    <p className="transform-preview__reason" role="status">{status.reason}</p>
    <details className="transform-preview__sample-summary"><summary>Sample traits</summary><span title={Object.entries(sampleTraits).map(([layer, value]) => `${layer}:${value}`).join(', ')}>{Object.entries(sampleTraits).map(([layer, value]) => `${layer}:${value}`).join(', ') || 'No loaded traits.'}</span></details>
    <div className={`transform-preview__stage${state.active ? '' : ' transform-preview__stage--inactive'}`} data-orientation={safeWidth >= safeHeight ? 'landscape' : 'portrait'} style={{ aspectRatio: `${safeWidth} / ${safeHeight}`, width: `${stageWidth}px`, maxWidth: '100%' }} tabIndex={0} role="group" aria-label={state.active ? `Preview affected layer ${affected?.layer}. Arrow keys nudge one pixel; Shift plus Arrow keys nudge ten pixels.` : `Inactive preview. ${status.reason}`} onPointerDown={onPointerDown} onPointerMove={(event) => { if (dragRef.current?.pointerId === event.pointerId) move(event.clientX, event.clientY); }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={onKeyDown}>
      <svg ref={canvasRef} className="transform-preview__canvas" style={{ width: '100%', height: '100%' }} viewBox={`0 0 ${safeWidth} ${safeHeight}`} width={safeWidth} height={safeHeight} role="img" aria-label="Layered transform sample art">
        {traitCatalog.map((entry, index) => {
          const id = entryId(entry, index);
          const image = images[id];
          const transform = transforms[id] as EffectiveTransform | undefined;
          return image && transform ? transformedLayer(id, image, transform, safeWidth, safeHeight, id === affectedLayerId) : null;
        })}
      </svg>
      {!Object.values(images).some(Boolean) ? <span className="label muted">{assetsReady ? 'No readable sample art.' : 'Loading deterministic sample art…'}</span> : null}
    </div>
    <div className="row wrap"><Button size="sm" variant="ghost" onClick={() => { const match = matchTransformPreviewSample(rule, traitCatalog, affected); setHasManualSamples(false); setSamples(match.samples); setMatchNote(match.reason); }} disabled={!traitCatalog.length || !affected}>Match rule</Button><Button size="sm" variant="ghost" onClick={() => onTranslateChange(x - 1, y)} disabled={!state.active}>← Nudge</Button><Button size="sm" variant="ghost" onClick={() => onTranslateChange(x + 1, y)} disabled={!state.active}>Nudge →</Button><span className="field-msg">Drag the outlined layer, or use Arrow keys. {safeWidth}×{safeHeight} source pixels.{hasVisualLimit ? ' Color, blend, and filter effects are not reproduced in this geometry preview.' : ''}</span></div>
  </section>;
}
