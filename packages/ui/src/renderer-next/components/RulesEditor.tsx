import { useState } from 'react';
import { Panel } from './Panel';
import { Button } from './Button';
import { Field, Input } from './Field';
import { useToast } from './Toast';

export interface RulesObj {
  mutuallyExclusive?: string[][];
  requires?: Array<{ if: string; thenAnyOf: string[] }>;
  maxOccurrences?: Array<{ trait: string; max: number }>;
  [k: string]: unknown;
}

const splitList = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// Structured editors for the common generation rules, plus a JSON escape hatch for
// transforms / anything advanced. Every edit spreads the existing rules object, so
// `transforms` and any unknown keys round-trip losslessly.
export function RulesEditor({ value, setRules }: { value: RulesObj; setRules: (next: RulesObj) => void }) {
  const toast = useToast();
  const [json, setJson] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const maxOcc = value.maxOccurrences ?? [];
  const mutex = value.mutuallyExclusive ?? [];
  const requires = value.requires ?? [];

  const setMaxOcc = (next: Array<{ trait: string; max: number }>) => setRules({ ...value, maxOccurrences: next });
  const setMutex = (next: string[][]) => setRules({ ...value, mutuallyExclusive: next });
  const setRequires = (next: Array<{ if: string; thenAnyOf: string[] }>) => setRules({ ...value, requires: next });

  const applyJson = () => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') throw new Error('Rules must be an object');
      setRules(parsed as RulesObj);
      setJsonErr(null);
      toast.push('Rules applied — remember to Save', 'ok');
    } catch (e) {
      setJsonErr(String((e as Error)?.message ?? e));
    }
  };

  return (
    <>
      <Panel
        title="Max occurrences"
        actions={
          <Button size="sm" onClick={() => setMaxOcc([...maxOcc, { trait: '', max: 1 }])}>
            + Add cap
          </Button>
        }
      >
        {maxOcc.length === 0 ? (
          <span className="label muted">Cap how many editions may carry a trait, e.g. <code>Background:Gold</code> max 10.</span>
        ) : (
          <div className="stack">
            {maxOcc.map((r, i) => (
              <div key={i} className="row">
                <Input
                  value={r.trait}
                  onChange={(e) => setMaxOcc(maxOcc.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)))}
                  placeholder="Layer:Value"
                  aria-label={`Max occurrence trait ${i + 1}`}
                />
                <Input
                  type="number"
                  min="0"
                  value={r.max}
                  onChange={(e) => setMaxOcc(maxOcc.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) || 0 } : x)))}
                  aria-label={`Max occurrence count ${i + 1}`}
                  style={{ width: 90 }}
                />
                <Button size="sm" variant="danger" icon onClick={() => setMaxOcc(maxOcc.filter((_, j) => j !== i))} aria-label={`Remove max occurrence ${i + 1}`}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Mutually exclusive"
        actions={
          <Button size="sm" onClick={() => setMutex([...mutex, []])}>
            + Add group
          </Button>
        }
      >
        {mutex.length === 0 ? (
          <span className="label muted">Traits that can never co-occur — one comma-separated group per row.</span>
        ) : (
          <div className="stack">
            {mutex.map((group, i) => (
              <div key={i} className="row">
                <Input
                  value={group.join(', ')}
                  onChange={(e) => setMutex(mutex.map((g, j) => (j === i ? splitList(e.target.value) : g)))}
                  placeholder="Eyes:Laser, Headwear:Visor"
                  aria-label={`Exclusive group ${i + 1}`}
                />
                <Button size="sm" variant="danger" icon onClick={() => setMutex(mutex.filter((_, j) => j !== i))} aria-label={`Remove group ${i + 1}`}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Requires"
        actions={
          <Button size="sm" onClick={() => setRequires([...requires, { if: '', thenAnyOf: [] }])}>
            + Add rule
          </Button>
        }
      >
        {requires.length === 0 ? (
          <span className="label muted">If a trait is present, require at least one of others.</span>
        ) : (
          <div className="stack">
            {requires.map((r, i) => (
              <div key={i} className="grid cols-auto">
                <Field label="If present">
                  <Input
                    value={r.if}
                    onChange={(e) => setRequires(requires.map((x, j) => (j === i ? { ...x, if: e.target.value } : x)))}
                    placeholder="Body:Robot"
                    aria-label={`Requires if ${i + 1}`}
                  />
                </Field>
                <Field label="Then any of">
                  <Input
                    value={r.thenAnyOf.join(', ')}
                    onChange={(e) => setRequires(requires.map((x, j) => (j === i ? { ...x, thenAnyOf: splitList(e.target.value) } : x)))}
                    placeholder="Head:Antenna, Head:Bolt"
                    aria-label={`Requires then ${i + 1}`}
                  />
                </Field>
                <div style={{ alignSelf: 'end' }}>
                  <Button size="sm" variant="danger" icon onClick={() => setRequires(requires.filter((_, j) => j !== i))} aria-label={`Remove requirement ${i + 1}`}>
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Transforms & advanced (JSON)"
        actions={
          <div className="row">
            <Button size="sm" variant="ghost" onClick={() => { setJson(JSON.stringify(value ?? {}, null, 2)); setJsonErr(null); }}>
              Reload
            </Button>
            <Button size="sm" onClick={applyJson}>
              Apply JSON
            </Button>
          </div>
        }
      >
        <div className="stack">
          <span className="label muted">
            The whole rules object (incl. transforms). Apply replaces it — click Reload to resync after using the editors above.
          </span>
          <textarea className="textarea" rows={8} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} aria-label="Rules JSON" />
          {jsonErr ? <div className="banner-error">Invalid JSON: {jsonErr}</div> : null}
        </div>
      </Panel>
    </>
  );
}
