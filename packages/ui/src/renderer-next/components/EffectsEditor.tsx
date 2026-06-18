import type { ReactNode } from 'react';
import { Field, Input, Select } from './Field';
import { BLEND_MODES } from '../lib/blend';
import type { LayerCfg, LayerEffects } from '../state/project';

type Mutate = (fn: (l: LayerCfg) => void) => void;
type EffectGroupName = 'glow' | 'stroke' | 'shadow' | 'extrude' | 'modulate' | 'colorOverlay';

function num(v: string): number | undefined {
  return v === '' ? undefined : Number(v);
}

// Structured editor for a single layer's compositing + visual effects. Effect *types*
// not rendered here are still preserved on save (the config is cloned, not rebuilt),
// so this is feature-preserving even while the editor surface grows incrementally.
export function EffectsEditor({ layer, onMutate }: { layer: LayerCfg; onMutate: Mutate }) {
  const eff: LayerEffects = layer.effects ?? {};
  const grp = (name: EffectGroupName): Record<string, unknown> => (eff[name] ?? {}) as Record<string, unknown>;

  const setEff = (key: keyof LayerEffects, value: unknown) =>
    onMutate((l) => {
      const e = (l.effects ??= {});
      if (value === undefined || value === '') delete (e as Record<string, unknown>)[key as string];
      else (e as Record<string, unknown>)[key as string] = value;
    });
  const groupOn = (g: EffectGroupName): boolean => !!eff[g];
  const toggleGroup = (g: EffectGroupName, on: boolean) =>
    onMutate((l) => {
      const e = (l.effects ??= {}) as Record<string, unknown>;
      if (on) e[g] = e[g] ?? {};
      else delete e[g];
    });
  const setField = (g: EffectGroupName, field: string, value: unknown) =>
    onMutate((l) => {
      const e = (l.effects ??= {}) as Record<string, Record<string, unknown>>;
      const obj = (e[g] ??= {});
      if (value === undefined || value === '') delete obj[field];
      else obj[field] = value;
    });

  return (
    <div className="stack">
      <div className="grid cols-auto">
        <Field label="Blend mode">
          <Select value={String(layer.blend ?? eff.blend ?? 'normal')} onChange={(e) => onMutate((l) => (l.blend = e.target.value))}>
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Offset X">
          <Input type="number" value={eff.offsetX ?? ''} onChange={(e) => setEff('offsetX', num(e.target.value))} />
        </Field>
        <Field label="Offset Y">
          <Input type="number" value={eff.offsetY ?? ''} onChange={(e) => setEff('offsetY', num(e.target.value))} />
        </Field>
        <Field label="Rotate °">
          <Input type="number" value={eff.rotate ?? ''} onChange={(e) => setEff('rotate', num(e.target.value))} />
        </Field>
        <Field label="Scale ×">
          <Input type="number" step="0.05" value={eff.scale ?? ''} onChange={(e) => setEff('scale', num(e.target.value))} />
        </Field>
        <Field label="Blur px">
          <Input type="number" min="0" value={eff.blur ?? ''} onChange={(e) => setEff('blur', num(e.target.value))} />
        </Field>
      </div>

      <Group label="Glow" on={groupOn('glow')} onToggle={(v) => toggleGroup('glow', v)}>
        <Field label="Color">
          <Input value={String(grp('glow').color ?? '')} onChange={(e) => setField('glow', 'color', e.target.value)} placeholder="#00eaff" />
        </Field>
        <Field label="Radius">
          <Input type="number" min="0" value={String(grp('glow').radius ?? '')} onChange={(e) => setField('glow', 'radius', num(e.target.value))} />
        </Field>
        <Field label="Opacity">
          <Input type="number" step="0.05" min="0" max="1" value={String(grp('glow').opacity ?? '')} onChange={(e) => setField('glow', 'opacity', num(e.target.value))} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={!!grp('glow').inner} onChange={(e) => setField('glow', 'inner', e.target.checked || undefined)} />
          <span className="label">Inner</span>
        </label>
      </Group>

      <Group label="Stroke" on={groupOn('stroke')} onToggle={(v) => toggleGroup('stroke', v)}>
        <Field label="Color">
          <Input value={String(grp('stroke').color ?? '')} onChange={(e) => setField('stroke', 'color', e.target.value)} />
        </Field>
        <Field label="Width">
          <Input type="number" min="1" value={String(grp('stroke').width ?? '')} onChange={(e) => setField('stroke', 'width', num(e.target.value))} />
        </Field>
        <Field label="Position">
          <Select value={String(grp('stroke').position ?? 'outside')} onChange={(e) => setField('stroke', 'position', e.target.value)}>
            <option value="outside">outside</option>
            <option value="inside">inside</option>
            <option value="center">center</option>
          </Select>
        </Field>
      </Group>

      <Group label="Shadow" on={groupOn('shadow')} onToggle={(v) => toggleGroup('shadow', v)}>
        <Field label="Color">
          <Input value={String(grp('shadow').color ?? '')} onChange={(e) => setField('shadow', 'color', e.target.value)} />
        </Field>
        <Field label="Blur">
          <Input type="number" min="0" value={String(grp('shadow').blur ?? '')} onChange={(e) => setField('shadow', 'blur', num(e.target.value))} />
        </Field>
        <Field label="Offset X">
          <Input type="number" value={String(grp('shadow').offsetX ?? '')} onChange={(e) => setField('shadow', 'offsetX', num(e.target.value))} />
        </Field>
        <Field label="Offset Y">
          <Input type="number" value={String(grp('shadow').offsetY ?? '')} onChange={(e) => setField('shadow', 'offsetY', num(e.target.value))} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={!!grp('shadow').inner} onChange={(e) => setField('shadow', 'inner', e.target.checked || undefined)} />
          <span className="label">Inner</span>
        </label>
      </Group>

      <Group label="Color overlay" on={groupOn('colorOverlay')} onToggle={(v) => toggleGroup('colorOverlay', v)}>
        <Field label="Color">
          <Input value={String(grp('colorOverlay').color ?? '')} onChange={(e) => setField('colorOverlay', 'color', e.target.value)} />
        </Field>
        <Field label="Opacity">
          <Input type="number" step="0.05" min="0" max="1" value={String(grp('colorOverlay').opacity ?? '')} onChange={(e) => setField('colorOverlay', 'opacity', num(e.target.value))} />
        </Field>
        <Field label="Blend">
          <Select value={String(grp('colorOverlay').blend ?? 'normal')} onChange={(e) => setField('colorOverlay', 'blend', e.target.value)}>
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </Group>

      <Group label="Modulate" on={groupOn('modulate')} onToggle={(v) => toggleGroup('modulate', v)}>
        <Field label="Hue °">
          <Input type="number" value={String(grp('modulate').hue ?? '')} onChange={(e) => setField('modulate', 'hue', num(e.target.value))} />
        </Field>
        <Field label="Saturation ×">
          <Input type="number" step="0.05" value={String(grp('modulate').saturation ?? '')} onChange={(e) => setField('modulate', 'saturation', num(e.target.value))} />
        </Field>
        <Field label="Brightness ×">
          <Input type="number" step="0.05" value={String(grp('modulate').brightness ?? '')} onChange={(e) => setField('modulate', 'brightness', num(e.target.value))} />
        </Field>
      </Group>

      <Group label="Extrude (3D)" on={groupOn('extrude')} onToggle={(v) => toggleGroup('extrude', v)}>
        <Field label="Color">
          <Input value={String(grp('extrude').color ?? '')} onChange={(e) => setField('extrude', 'color', e.target.value)} />
        </Field>
        <Field label="Depth">
          <Input type="number" min="1" value={String(grp('extrude').depth ?? '')} onChange={(e) => setField('extrude', 'depth', num(e.target.value))} />
        </Field>
        <Field label="Angle °">
          <Input type="number" value={String(grp('extrude').angle ?? '')} onChange={(e) => setField('extrude', 'angle', num(e.target.value))} />
        </Field>
      </Group>
    </div>
  );
}

function Group({ label, on, onToggle, children }: { label: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="effect-group">
      <label className="effect-group-head">
        <input type="checkbox" aria-label={label} checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span className="label">{label}</span>
      </label>
      {on ? <div className="grid cols-auto effect-group-body">{children}</div> : null}
    </div>
  );
}
