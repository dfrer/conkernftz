import { Button } from './Button';
import { Field, Input, Select } from './Field';
import { EffectsEditor } from './EffectsEditor';
import type { AssetOverrideCfg, LayerEffects } from '../state/project';

// Mutate the overrides list in place; the caller persists.
type Mutate = (mut: (list: AssetOverrideCfg[]) => void) => void;

// Per-asset effect overrides for a layer. Each override targets an asset by trait value
// or filename and carries its own effects object (edited with the shared EffectsEditor).
export function OverridesEditor({ overrides, onChange }: { overrides: AssetOverrideCfg[]; onChange: Mutate }) {
  const add = () => onChange((list) => list.push({ target: 'value', match: '', effects: {} }));
  const remove = (i: number) => onChange((list) => list.splice(i, 1));
  const setField = (i: number, patch: Partial<AssetOverrideCfg>) =>
    onChange((list) => {
      list[i] = { ...list[i], ...patch } as AssetOverrideCfg;
    });
  const editEffects = (i: number, mut: (e: LayerEffects) => void) =>
    onChange((list) => {
      const o = list[i];
      if (o) {
        o.effects = o.effects ?? {};
        mut(o.effects);
      }
    });

  return (
    <div className="stack">
      <div className="row spread">
        <span className="label">Per-asset overrides</span>
        <Button size="sm" onClick={add}>
          + Add override
        </Button>
      </div>
      {overrides.length === 0 ? (
        <span className="label muted">Override effects for a specific asset, matched by trait value or filename.</span>
      ) : (
        overrides.map((ov, i) => (
          <div key={i} className="panel panel--inset" style={{ padding: 'var(--sp-3)' }}>
            <div className="grid cols-auto">
              <Field label="Target">
                <Select value={ov.target ?? 'value'} onChange={(e) => setField(i, { target: e.target.value as 'filename' | 'value' })} aria-label={`Override target ${i + 1}`}>
                  <option value="value">value</option>
                  <option value="filename">filename</option>
                </Select>
              </Field>
              <Field label="Match">
                <Input value={ov.match ?? ''} onChange={(e) => setField(i, { match: e.target.value })} placeholder="Gold or Gold#5.png" aria-label={`Override match ${i + 1}`} />
              </Field>
              <div style={{ alignSelf: 'end' }}>
                <Button size="sm" variant="danger" icon onClick={() => remove(i)} aria-label={`Remove override ${i + 1}`}>
                  ✕
                </Button>
              </div>
            </div>
            <EffectsEditor effects={ov.effects ?? {}} onChange={(mut) => editEffects(i, mut)} />
          </div>
        ))
      )}
    </div>
  );
}
