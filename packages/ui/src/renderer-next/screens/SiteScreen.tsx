import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';
import { resolveExperience, type ExperienceConfig } from '../lib/mintExperience';
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  addBlock,
  defaultSite,
  moveBlock,
  removeBlock,
  resolveSite,
  setTheme,
  updateBlock,
  type Block,
  type BlockKind,
  type SiteConfig,
} from '../lib/site';

export function SiteScreen() {
  const { project, config, updateConfig, save } = useProject();
  const toast = useToast();
  const [site, setSite] = useState<SiteConfig>(() => {
    const existing = config?.site as Partial<SiteConfig> | undefined;
    const r = existing ? resolveSite(existing) : defaultSite();
    return r.blocks.length ? r : defaultSite();
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => null);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const experience: ExperienceConfig = resolveExperience(config?.mintExperience as Partial<ExperienceConfig> | undefined);
  const selected = site.blocks.find((b) => b.id === selectedId) ?? site.blocks[0] ?? null;
  const setField = (patch: Record<string, unknown>): void => {
    if (selected) setSite(updateBlock(site, selected.id, patch));
  };

  const add = (kind: BlockKind): void => {
    const next = addBlock(site, kind);
    setSite(next);
    setSelectedId(next.blocks[next.blocks.length - 1]!.id);
  };

  const loadArt = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project to load live art', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
      if (r.ok && Array.isArray(r.images)) {
        const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
        setImages(r.images.map((b) => `data:${mime};base64,${b}`));
        toast.push(`Loaded ${r.images.length} preview images`, 'ok');
      } else {
        toast.push(r.error ?? 'Preview failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (): Promise<void> => {
    updateConfig((d) => {
      (d as Record<string, unknown>).site = site;
    });
    const ok = await save();
    if (ok) toast.push('Mint site saved', 'ok');
  };

  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">STAGE // MINT SITE</div>
          <h1 className="main-title">Site builder</h1>
        </div>
        <div className="row">
          <Button size="sm" onClick={loadArt} disabled={busy || !isBridged()}>
            {busy ? 'Loading…' : 'Use live art'}
          </Button>
          <Button onClick={onSave} variant="primary" disabled={!project}>
            Save
          </Button>
        </div>
      </div>

      {!project ? (
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to build its mint site." />
      ) : (
        <>
          <Panel title="Theme">
            <div className="grid cols-auto">
              <Field label="Accent">
                <Input value={site.theme.accent} onChange={(e) => setSite(setTheme(site, { accent: e.target.value }))} />
              </Field>
              <Field label="Background">
                <Select aria-label="Background" value={site.theme.background} onChange={(e) => setSite(setTheme(site, { background: e.target.value as SiteConfig['theme']['background'] }))}>
                  <option value="ink">ink</option>
                  <option value="void">void</option>
                  <option value="manila">manila</option>
                  <option value="paper">paper</option>
                </Select>
              </Field>
              <Field label="Font">
                <Select aria-label="Font" value={site.theme.font} onChange={(e) => setSite(setTheme(site, { font: e.target.value as SiteConfig['theme']['font'] }))}>
                  <option value="sans">sans</option>
                  <option value="mono">mono</option>
                  <option value="display">display</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel title="Blocks" actions={<span className="label">{site.blocks.length} BLOCKS</span>}>
            <div className="stack">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {BLOCK_KINDS.map((k) => (
                  <Button key={k} size="sm" variant="ghost" onClick={() => add(k)}>
                    + {BLOCK_LABELS[k]}
                  </Button>
                ))}
              </div>
              <div className="stack">
                {site.blocks.map((b, i) => (
                  <div key={b.id} className={`row block-row${selected?.id === b.id ? ' block-row--sel' : ''}`}>
                    <button type="button" className="block-row-label" onClick={() => setSelectedId(b.id)} aria-label={`Select block ${i + 1} (${BLOCK_LABELS[b.kind]})`}>
                      <span className="label">{i + 1}. {BLOCK_LABELS[b.kind]}</span>
                    </button>
                    <Button size="sm" variant="ghost" icon onClick={() => setSite(moveBlock(site, b.id, -1))} aria-label={`Move block ${i + 1} up`}>↑</Button>
                    <Button size="sm" variant="ghost" icon onClick={() => setSite(moveBlock(site, b.id, 1))} aria-label={`Move block ${i + 1} down`}>↓</Button>
                    <Button size="sm" variant="danger" icon onClick={() => setSite(removeBlock(site, b.id))} aria-label={`Remove block ${i + 1}`}>✕</Button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {selected ? (
            <Panel title={`Edit — ${BLOCK_LABELS[selected.kind]}`}>
              <BlockFields block={selected} setField={setField} />
            </Panel>
          ) : null}

          <Panel title="Preview">
            <SiteRenderer site={site} images={images} experience={experience} />
          </Panel>
        </>
      )}
    </div>
  );
}

function BlockFields({ block, setField }: { block: Block; setField: (patch: Record<string, unknown>) => void }) {
  switch (block.kind) {
    case 'hero':
      return (
        <div className="grid cols-auto">
          <Field label="Title">
            <Input value={block.title} onChange={(e) => setField({ title: e.target.value })} aria-label="Hero title" />
          </Field>
          <Field label="Subtitle">
            <Input value={block.subtitle} onChange={(e) => setField({ subtitle: e.target.value })} aria-label="Hero subtitle" />
          </Field>
          <Field label="Align">
            <Select aria-label="Hero align" value={block.align} onChange={(e) => setField({ align: e.target.value })}>
              <option value="center">center</option>
              <option value="left">left</option>
            </Select>
          </Field>
        </div>
      );
    case 'richText':
      return (
        <div className="stack">
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Text heading" />
          </Field>
          <Field label="Body">
            <textarea className="textarea" rows={4} value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Text body" />
          </Field>
        </div>
      );
    case 'gallery':
      return (
        <div className="grid cols-auto">
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Gallery heading" />
          </Field>
          <Field label="Columns">
            <Input type="number" min="1" max="6" value={block.columns} onChange={(e) => setField({ columns: Number(e.target.value) || 1 })} aria-label="Gallery columns" />
          </Field>
          <Field label="Count">
            <Input type="number" min="1" max="24" value={block.count} onChange={(e) => setField({ count: Number(e.target.value) || 1 })} aria-label="Gallery count" />
          </Field>
        </div>
      );
    case 'mint':
      return (
        <div className="grid cols-auto">
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Mint heading" />
          </Field>
          <Field label="Price label">
            <Input value={block.price} onChange={(e) => setField({ price: e.target.value })} placeholder="0.05 ETH" aria-label="Mint price" />
          </Field>
          <span className="label muted">Uses the experience from the Mint FX stage.</span>
        </div>
      );
    case 'faq':
      return (
        <div className="stack">
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="FAQ heading" />
          </Field>
          {block.items.map((it, i) => (
            <div key={i} className="grid cols-auto">
              <Field label={`Q${i + 1}`}>
                <Input value={it.q} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} aria-label={`FAQ question ${i + 1}`} />
              </Field>
              <Field label={`A${i + 1}`}>
                <Input value={it.a} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} aria-label={`FAQ answer ${i + 1}`} />
              </Field>
              <div style={{ alignSelf: 'end' }}>
                <Button size="sm" variant="danger" icon onClick={() => setField({ items: block.items.filter((_, j) => j !== i) })} aria-label={`Remove FAQ ${i + 1}`}>✕</Button>
              </div>
            </div>
          ))}
          <div>
            <Button size="sm" onClick={() => setField({ items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}>+ Add Q&amp;A</Button>
          </div>
        </div>
      );
    case 'marquee':
      return (
        <Field label="Marquee text">
          <Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Marquee text" />
        </Field>
      );
    case 'divider':
      return <span className="label muted">A horizontal rule. No options.</span>;
  }
}
