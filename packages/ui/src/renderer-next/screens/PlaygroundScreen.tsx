import { useState } from 'react';
import { Panel, Button, Field, Input, Select, Badge, Lamp, Skeleton, Dialog, EmptyState, Tabs, TabPanel, RarityBar, useToast } from '../components';

// In-app component playground — the visual catalog of the design system. Doubles as a
// manual-QA surface until full visual-regression tooling lands.
export function PlaygroundScreen() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('one');
  const toast = useToast();
  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">SYSTEM // DESIGN LIBRARY</div>
          <h1 className="main-title">Components</h1>
        </div>
      </div>

      <Panel title="Buttons">
        <div className="row wrap">
          <Button variant="primary">Primary</Button>
          <Button>Default</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
        </div>
      </Panel>

      <Panel title="Fields">
        <div className="grid cols-auto">
          <Field label="Collection name">
            <Input placeholder="e.g. Specimens" />
          </Field>
          <Field label="Image format">
            <Select defaultValue="png">
              <option value="png">png</option>
              <option value="webp">webp</option>
              <option value="gif">gif</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel title="Status indicators">
        <div className="row wrap">
          <Badge>default</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="ok">ok</Badge>
          <span className="row">
            <Lamp state="on" /> on
          </span>
          <span className="row">
            <Lamp state="ok" /> ok
          </span>
          <span className="row">
            <Lamp state="danger" pulse /> alert
          </span>
        </div>
      </Panel>

      <Panel title="Overlays">
        <div className="row wrap">
          <Button onClick={() => setOpen(true)}>Open dialog</Button>
          <Button onClick={() => toast.push('Saved to dossier', 'ok')}>Toast OK</Button>
          <Button variant="danger" onClick={() => toast.push('Upload failed', 'danger')}>
            Toast error
          </Button>
        </div>
      </Panel>

      <Panel title="Tabs">
        <Tabs
          tabs={[
            { id: 'one', label: 'Overview' },
            { id: 'two', label: 'Layers', badge: 4 },
            { id: 'three', label: 'Rules' },
          ]}
          active={tab}
          onChange={setTab}
          ariaLabel="Playground tabs"
        />
        <TabPanel id="one" active={tab}>
          <p className="muted">Roving-tabindex tablist — arrow keys, Home/End, and click all select. Used to section dense screens.</p>
        </TabPanel>
        <TabPanel id="two" active={tab}>
          <p className="muted">Tabs accept an optional trailing badge (e.g. a count).</p>
        </TabPanel>
        <TabPanel id="three" active={tab}>
          <p className="muted">Only the active panel renders, so heavy sections stay unmounted until shown.</p>
        </TabPanel>
      </Panel>

      <Panel title="Rarity bar">
        <div className="stack" style={{ maxWidth: 280 }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="label muted">Balanced (4 traits)</span>
            <RarityBar rows={[{ value: 'A', probability: 0.25 }, { value: 'B', probability: 0.25 }, { value: 'C', probability: 0.25 }, { value: 'D', probability: 0.25 }]} />
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <span className="label muted">Skewed (one dominant)</span>
            <RarityBar rows={[{ value: 'Common', probability: 0.8 }, { value: 'Rare', probability: 0.15 }, { value: 'Legendary', probability: 0.05 }]} />
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <span className="label muted">Empty layer</span>
            <RarityBar rows={[]} />
          </div>
        </div>
      </Panel>

      <Panel title="Loading + empty">
        <div className="stack">
          <Skeleton w={260} />
          <Skeleton w={190} />
          <Skeleton w={320} />
          <EmptyState title="Nothing here yet" hint="Empty states always tell the operator what to do next." />
        </div>
      </Panel>

      <Dialog open={open} title="Confirm action" onClose={() => setOpen(false)}>
        <p className="muted">Dialogs close on Escape and click-outside. Use for confirmations and focused forms.</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setOpen(false);
              toast.push('Confirmed', 'ok');
            }}
          >
            Confirm
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
