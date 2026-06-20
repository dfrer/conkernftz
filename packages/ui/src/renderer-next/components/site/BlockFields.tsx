import { Field, Input, Select } from '../Field';
import { Button } from '../Button';
import { isBridged } from '../../lib/bridge';
import type { Block } from '../../lib/site';

// Per-block content editor for the Site builder inspector — the kind-specific fields. Size,
// alignment, color, and canvas position live in the Edit panel around this (SiteScreen), since
// those apply across many kinds; this is purely the per-kind content.
export function BlockFields({
  block,
  setField,
  onUpload,
}: {
  block: Block;
  setField: (patch: Record<string, unknown>) => void;
  onUpload: (apply: (dataUrl: string) => void) => void;
}) {
  switch (block.kind) {
    case 'hero':
      return (
        <div className="grid cols-auto">
          <Field label="Title"><Input value={block.title} onChange={(e) => setField({ title: e.target.value })} aria-label="Hero title" /></Field>
          <Field label="Subtitle"><Input value={block.subtitle} onChange={(e) => setField({ subtitle: e.target.value })} aria-label="Hero subtitle" /></Field>
        </div>
      );
    case 'richText':
      return (
        <div className="stack">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Text heading" /></Field>
          <Field label="Body"><textarea className="textarea" rows={4} value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Text body" /></Field>
        </div>
      );
    case 'gallery':
      return (
        <div className="grid cols-auto">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Gallery heading" /></Field>
          <Field label="Columns"><Input type="number" min="1" max="6" value={block.columns} onChange={(e) => setField({ columns: Number(e.target.value) || 1 })} aria-label="Gallery columns" /></Field>
          <Field label="Count"><Input type="number" min="1" max="24" value={block.count} onChange={(e) => setField({ count: Number(e.target.value) || 1 })} aria-label="Gallery count" /></Field>
        </div>
      );
    case 'mint':
      return (
        <div className="grid cols-auto">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Mint heading" /></Field>
          <Field label="Price label"><Input value={block.price} onChange={(e) => setField({ price: e.target.value })} placeholder="0.05 ETH" aria-label="Mint price" /></Field>
          <span className="label muted">Uses the experience from the Mint FX stage.</span>
        </div>
      );
    case 'faq':
      return (
        <div className="stack">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="FAQ heading" /></Field>
          {block.items.map((it, i) => (
            <div key={i} className="grid cols-auto">
              <Field label={`Q${i + 1}`}><Input value={it.q} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} aria-label={`FAQ question ${i + 1}`} /></Field>
              <Field label={`A${i + 1}`}><Input value={it.a} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} aria-label={`FAQ answer ${i + 1}`} /></Field>
              <div style={{ alignSelf: 'end' }}>
                <Button size="sm" variant="danger" icon onClick={() => setField({ items: block.items.filter((_, j) => j !== i) })} aria-label={`Remove FAQ ${i + 1}`}>✕</Button>
              </div>
            </div>
          ))}
          <div><Button size="sm" onClick={() => setField({ items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}>+ Add Q&amp;A</Button></div>
        </div>
      );
    case 'marquee':
      return <Field label="Marquee text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Marquee text" /></Field>;
    case 'blink':
      return (
        <div className="grid cols-auto">
          <Field label="Text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Blink text" /></Field>
          <Field label="Color"><Input value={block.color} onChange={(e) => setField({ color: e.target.value })} aria-label="Blink color" /></Field>
        </div>
      );
    case 'image':
      return (
        <div className="stack">
          <Field label="Image / GIF">
            <div className="row">
              <Input value={block.src} onChange={(e) => setField({ src: e.target.value })} placeholder="data: or https URL / GIF" aria-label="Image src" style={{ flex: 1 }} />
              <Button size="sm" onClick={() => onUpload((u) => setField({ src: u }))} disabled={!isBridged()}>
                Upload…
              </Button>
            </div>
          </Field>
          <Field label="Alt"><Input value={block.alt} onChange={(e) => setField({ alt: e.target.value })} aria-label="Image alt" /></Field>
        </div>
      );
    case 'hitCounter':
      return (
        <div className="stack">
          <div className="grid cols-auto">
            <Field label="Label"><Input value={block.label} onChange={(e) => setField({ label: e.target.value })} aria-label="Counter label" /></Field>
            <Field label="Start"><Input type="number" min="0" value={block.start} onChange={(e) => setField({ start: Number(e.target.value) || 0 })} aria-label="Counter start" /></Field>
          </div>
          <Field label="Counter image URL (real count)">
            <Input value={block.src ?? ''} onChange={(e) => setField({ src: e.target.value || undefined })} placeholder="(static) — paste a counter-service image URL for a live count" aria-label="Counter image URL" />
          </Field>
          <span className="label muted">A static site can't count visits itself. Paste a free counter-service image URL (e.g. hitwebcounter) for a real global count; otherwise the number above is decorative.</span>
        </div>
      );
    case 'html':
      return <Field label="Raw HTML"><textarea className="textarea" rows={6} spellCheck={false} value={block.html} onChange={(e) => setField({ html: e.target.value })} aria-label="Raw HTML" /></Field>;
    case 'wordArt':
      return (
        <div className="grid cols-auto">
          <Field label="Text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="WordArt text" /></Field>
          <Field label="Style">
            <Select aria-label="WordArt style" value={block.style} onChange={(e) => setField({ style: e.target.value })}>
              <option value="rainbow">rainbow</option>
              <option value="chrome">chrome</option>
              <option value="fire">fire</option>
            </Select>
          </Field>
        </div>
      );
    case 'button':
      return (
        <div className="grid cols-auto">
          <Field label="Label"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Button label" /></Field>
          <Field label="Link"><Input value={block.href} onChange={(e) => setField({ href: e.target.value })} placeholder="https://" aria-label="Button href" /></Field>
          <Field label="Badge image (88×31)">
            <div className="row">
              <Input value={block.src ?? ''} onChange={(e) => setField({ src: e.target.value || undefined })} placeholder="(text label) — or a data:/https badge" aria-label="Button badge image" style={{ flex: 1 }} />
              <Button size="sm" onClick={() => onUpload((u) => setField({ src: u }))} disabled={!isBridged()}>
                Upload…
              </Button>
            </div>
          </Field>
        </div>
      );
    case 'webRing':
      return (
        <div className="stack">
          <Field label="Ring name"><Input value={block.name} onChange={(e) => setField({ name: e.target.value })} aria-label="Web ring name" /></Field>
          <div className="grid cols-auto">
            <Field label="‹ Prev URL"><Input value={block.prev ?? ''} onChange={(e) => setField({ prev: e.target.value || undefined })} placeholder="https://" aria-label="Web ring prev URL" /></Field>
            <Field label="Random URL"><Input value={block.random ?? ''} onChange={(e) => setField({ random: e.target.value || undefined })} placeholder="https://" aria-label="Web ring random URL" /></Field>
            <Field label="Next › URL"><Input value={block.next ?? ''} onChange={(e) => setField({ next: e.target.value || undefined })} placeholder="https://" aria-label="Web ring next URL" /></Field>
            <Field label="Hub URL (name)"><Input value={block.hub ?? ''} onChange={(e) => setField({ hub: e.target.value || undefined })} placeholder="https://" aria-label="Web ring hub URL" /></Field>
          </div>
          <span className="label muted">Prev / Random / Next become real links when a URL is set; the name links to the hub.</span>
        </div>
      );
    case 'underConstruction':
      return <Field label="Banner text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Construction text" /></Field>;
    case 'bestViewed':
      return <Field label="Badge text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Best viewed text" /></Field>;
    case 'audio':
      return (
        <div className="stack">
          <Field label="Audio URL (MIDI / MP3)"><Input value={block.src} onChange={(e) => setField({ src: e.target.value })} placeholder="data: or https URL" aria-label="Audio src" /></Field>
          <Field label="Label"><Input value={block.label} onChange={(e) => setField({ label: e.target.value })} aria-label="Audio label" /></Field>
          <label className="row"><input type="checkbox" checked={block.loop} onChange={(e) => setField({ loop: e.target.checked })} aria-label="Loop" /><span className="label">Loop</span></label>
          <label className="row"><input type="checkbox" checked={block.autoplay} onChange={(e) => setField({ autoplay: e.target.checked })} aria-label="Autoplay" /><span className="label">Autoplay (browsers may block until interaction)</span></label>
        </div>
      );
    case 'guestbook':
      return (
        <div className="grid cols-auto">
          <Field label="Label"><Input value={block.label} onChange={(e) => setField({ label: e.target.value })} aria-label="Guestbook label" /></Field>
          <Field label="Service URL"><Input value={block.href} onChange={(e) => setField({ href: e.target.value })} placeholder="https:// (external guestbook)" aria-label="Guestbook href" /></Field>
          <span className="label muted">Static sites can't store entries — link to an external guestbook service.</span>
        </div>
      );
    case 'divider':
      return <span className="label muted">A horizontal rule. No options.</span>;
  }
}
