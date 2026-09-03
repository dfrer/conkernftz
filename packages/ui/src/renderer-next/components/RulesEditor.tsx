import { useEffect, useState } from 'react';
import { Panel } from './Panel';
import { Button } from './Button';
import { Field, Input } from './Field';
import { useToast } from './Toast';
import {
  TransformRulesEditor,
  type TransformRuleValue,
  type TransformTraitCatalogLayer,
} from './TransformRulesEditor';

export interface RulesObj {
  mutuallyExclusive?: string[][];
  requires?: Array<{ if: string; thenAnyOf: string[] }>;
  maxOccurrences?: Array<{ trait: string; max: number }>;
  targets?: Array<{ trait: string; count: number }>;
  transforms?: TransformRuleValue[];
  [k: string]: unknown;
}

const splitList = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const positiveWholeNumber = (text: string): number => {
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
};

const nonnegativeWholeNumber = (text: string): number => {
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

// Structured editors preserve the original rules object and its unknown keys. The raw
// JSON escape hatch remains deliberately explicit for values not yet surfaced here.
export function RulesEditor({
  value,
  setRules,
  layerNames = [],
  traitCatalog = [],
  imageWidth = 1024,
  imageHeight = 1024,
  projectScope = '',
}: {
  value: RulesObj;
  setRules: (next: RulesObj) => void;
  layerNames?: string[];
  traitCatalog?: TransformTraitCatalogLayer[];
  imageWidth?: number;
  imageHeight?: number;
  projectScope?: string;
}) {
  const toast = useToast();
  const sourceSnapshot = JSON.stringify(value ?? {});
  const [json, setJson] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [jsonBaseline, setJsonBaseline] = useState(sourceSnapshot);
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [jsonDirty, setJsonDirty] = useState(false);
  const jsonSourceChanged = jsonDirty && sourceSnapshot !== jsonBaseline;

  const reloadJson = () => {
    setJson(JSON.stringify(value ?? {}, null, 2));
    setJsonBaseline(sourceSnapshot);
    setJsonDirty(false);
    setJsonErr(null);
  };

  useEffect(() => {
    if (!jsonDirty && sourceSnapshot !== jsonBaseline) reloadJson();
    // Track the serialized Rules value, not its object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceSnapshot, jsonBaseline, jsonDirty]);

  const maxOcc = value.maxOccurrences ?? [];
  const targets = value.targets ?? [];
  const mutex = value.mutuallyExclusive ?? [];
  const requires = value.requires ?? [];

  const setTargets = (next: Array<{ trait: string; count: number }>) =>
    setRules({ ...value, targets: next });
  const setMaxOcc = (next: Array<{ trait: string; max: number }>) =>
    setRules({ ...value, maxOccurrences: next });
  const setMutex = (next: string[][]) => setRules({ ...value, mutuallyExclusive: next });
  const setRequires = (next: Array<{ if: string; thenAnyOf: string[] }>) =>
    setRules({ ...value, requires: next });

  const applyJson = () => {
    if (jsonSourceChanged) return;
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Rules must be an object');
      setRules(parsed as RulesObj);
      setJsonBaseline(JSON.stringify(parsed));
      setJsonErr(null);
      setJsonDirty(false);
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
          <span className="label muted">
            Cap how many editions may carry a trait, e.g. <code>Background:Gold</code> max 10.
          </span>
        ) : (
          <div className="stack">
            {maxOcc.map((r, i) => (
              <div key={i} className="row">
                <Input
                  value={r.trait}
                  onChange={(e) =>
                    setMaxOcc(maxOcc.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)))
                  }
                  placeholder="Layer:Value"
                  aria-label={`Max occurrence trait ${i + 1}`}
                />
                <Input
                  type="number"
                  min="1"
                  value={r.max}
                  onChange={(e) =>
                    setMaxOcc(
                      maxOcc.map((x, j) =>
                        j === i ? { ...x, max: positiveWholeNumber(e.target.value) } : x,
                      ),
                    )
                  }
                  aria-label={`Max occurrence count ${i + 1}`}
                  style={{ width: 90 }}
                />
                <Button
                  size="sm"
                  variant="danger"
                  icon
                  onClick={() => setMaxOcc(maxOcc.filter((_, j) => j !== i))}
                  aria-label={`Remove max occurrence ${i + 1}`}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Distribution targets"
        actions={
          <Button size="sm" onClick={() => setTargets([...targets, { trait: '', count: 0 }])}>
            + Add target
          </Button>
        }
      >
        {targets.length === 0 ? (
          <span className="label muted">
            Steer generation to an <em>exact</em> count for a trait, e.g.{' '}
            <code>Background:Gold</code> in exactly 100 editions.
          </span>
        ) : (
          <div className="stack">
            {targets.map((r, i) => (
              <div key={i} className="row">
                <Input
                  value={r.trait}
                  onChange={(e) =>
                    setTargets(
                      targets.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)),
                    )
                  }
                  placeholder="Layer:Value"
                  aria-label={`Target trait ${i + 1}`}
                />
                <Input
                  type="number"
                  min="0"
                  value={r.count}
                  onChange={(e) =>
                    setTargets(
                      targets.map((x, j) =>
                        j === i ? { ...x, count: nonnegativeWholeNumber(e.target.value) } : x,
                      ),
                    )
                  }
                  aria-label={`Target count ${i + 1}`}
                  style={{ width: 90 }}
                />
                <Button
                  size="sm"
                  variant="danger"
                  icon
                  onClick={() => setTargets(targets.filter((_, j) => j !== i))}
                  aria-label={`Remove target ${i + 1}`}
                >
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
          <span className="label muted">
            Traits that can never co-occur — one comma-separated group per row.
          </span>
        ) : (
          <div className="stack">
            {mutex.map((group, i) => (
              <div key={i} className="row">
                <Input
                  value={group.join(', ')}
                  onChange={(e) =>
                    setMutex(mutex.map((g, j) => (j === i ? splitList(e.target.value) : g)))
                  }
                  placeholder="Eyes:Laser, Headwear:Visor"
                  aria-label={`Exclusive group ${i + 1}`}
                />
                <Button
                  size="sm"
                  variant="danger"
                  icon
                  onClick={() => setMutex(mutex.filter((_, j) => j !== i))}
                  aria-label={`Remove group ${i + 1}`}
                >
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
          <span className="label muted">
            If a trait is present, require at least one of others.
          </span>
        ) : (
          <div className="stack">
            {requires.map((r, i) => (
              <div key={i} className="grid cols-auto">
                <Field label="If present">
                  <Input
                    value={r.if}
                    onChange={(e) =>
                      setRequires(
                        requires.map((x, j) => (j === i ? { ...x, if: e.target.value } : x)),
                      )
                    }
                    placeholder="Body:Robot"
                    aria-label={`Requires if ${i + 1}`}
                  />
                </Field>
                <Field label="Then any of">
                  <Input
                    value={r.thenAnyOf.join(', ')}
                    onChange={(e) =>
                      setRequires(
                        requires.map((x, j) =>
                          j === i ? { ...x, thenAnyOf: splitList(e.target.value) } : x,
                        ),
                      )
                    }
                    placeholder="Head:Antenna, Head:Bolt"
                    aria-label={`Requires then ${i + 1}`}
                  />
                </Field>
                <div style={{ alignSelf: 'end' }}>
                  <Button
                    size="sm"
                    variant="danger"
                    icon
                    onClick={() => setRequires(requires.filter((_, j) => j !== i))}
                    aria-label={`Remove requirement ${i + 1}`}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <TransformRulesEditor
        value={value.transforms}
        layerNames={layerNames}
        traitCatalog={traitCatalog}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        projectScope={projectScope}
        onChange={(transforms) => setRules({ ...value, transforms })}
      />

      <Panel
        title="Advanced rules (JSON)"
        actions={
          <div className="row">
            <Button size="sm" variant="ghost" onClick={reloadJson} aria-label="Reload Rules JSON">
              Reload
            </Button>
            <Button size="sm" onClick={applyJson} disabled={!jsonDirty || jsonSourceChanged}>
              Apply JSON
            </Button>
          </div>
        }
      >
        <div className="stack">
          <span className="label muted">
            The full rules object is available for advanced fields. Applying this explicit JSON
            replaces Rules; Reload first if structured settings changed after this draft began.
          </span>
          <textarea
            className="textarea"
            rows={8}
            spellCheck={false}
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setJsonDirty(true);
            }}
            aria-label="Rules JSON"
          />
          {jsonSourceChanged ? (
            <div className="banner-error" role="alert">
              Structured Rules changed after this JSON draft began. Reload before applying.
            </div>
          ) : null}
          {jsonErr ? (
            <div className="banner-error" role="alert">
              Invalid JSON: {jsonErr}
            </div>
          ) : null}
        </div>
      </Panel>
    </>
  );
}
