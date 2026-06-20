import { useState } from 'react';
import { Panel, StageHeader, Button, Field, Input, Select, Badge, Lamp, Skeleton, Dialog, EmptyState, Tabs, TabPanel, RarityBar, useToast } from '../components';

// In-app component playground — the living catalog of the design system and the owner's review
// surface for it. Shows every primitive across every interaction state (variant, size, disabled,
// loading, focus, error, empty) so consistency is checkable at a glance, in both themes.
export function PlaygroundScreen() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('one');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Fire a transient loading state so the spinner/busy treatment is reviewable live.
  const demoLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1600);
  };

  return (
    <div className="stack stagger">
      <StageHeader kicker="SYSTEM // DESIGN LIBRARY" title="Components" />

      <Panel title="Buttons">
        <div className="stack" style={{ gap: 'var(--sp-4)' }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="label muted">Variants</span>
            <div className="row wrap">
              <Button variant="primary">Primary</Button>
              <Button>Default</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="label muted">Small + icon</span>
            <div className="row wrap">
              <Button variant="primary" size="sm">Primary</Button>
              <Button size="sm">Default</Button>
              <Button variant="ghost" size="sm">Ghost</Button>
              <Button variant="danger" size="sm">Danger</Button>
              <Button icon aria-label="Settings">⚙</Button>
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="label muted">Disabled · loading</span>
            <div className="row wrap">
              <Button variant="primary" disabled>Disabled</Button>
              <Button disabled>Disabled</Button>
              <Button variant="danger" disabled>Disabled</Button>
              <Button variant="primary" loading={loading} onClick={demoLoad}>
                {loading ? 'Working…' : 'Run task'}
              </Button>
            </div>
          </div>
          <p className="hint label muted" style={{ margin: 0 }}>
            Keyboard-focus any button to see the amber <code>:focus-visible</code> ring (tokens drive it in both themes).
          </p>
        </div>
      </Panel>

      <Panel title="Fields">
        <div className="grid cols-auto">
          <Field label="Collection name" hint="Shown to collectors on the mint site.">
            <Input placeholder="e.g. Specimens" />
          </Field>
          <Field label="Image format">
            <Select defaultValue="png">
              <option value="png">png</option>
              <option value="webp">webp</option>
              <option value="gif">gif</option>
            </Select>
          </Field>
          <Field label="Treasury address" error="Not a valid 0x address.">
            <Input defaultValue="0xnope" invalid />
          </Field>
          <Field label="Locked (public phase opened)">
            <Input defaultValue="0.01" disabled />
          </Field>
        </div>
      </Panel>

      <Panel title="Status — badges">
        <div className="row wrap">
          <Badge>default</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="ok">ok</Badge>
          <Badge tone="danger">danger</Badge>
          <Badge tone="info">info</Badge>
          <Badge tone="warn">warn</Badge>
        </div>
      </Panel>

      <Panel title="Status — lamps">
        <div className="row wrap">
          <span className="row"><Lamp state="off" /> off</span>
          <span className="row"><Lamp state="on" /> on</span>
          <span className="row"><Lamp state="ok" /> ok</span>
          <span className="row"><Lamp state="danger" /> danger</span>
          <span className="row"><Lamp state="danger" pulse /> alert (pulse)</span>
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

      <Panel title="Loading — skeletons">
        <div className="stack">
          <Skeleton w={260} />
          <Skeleton w={190} />
          <Skeleton w={320} />
        </div>
      </Panel>

      <Panel title="Empty states">
        <div className="grid cols-auto">
          <EmptyState title="Nothing here yet" hint="Empty states always tell the operator what to do next." />
          <EmptyState
            code="NO PROJECT"
            title="Open a collection"
            hint="With an action, the next step is one click away."
            action={<Button variant="primary" size="sm" onClick={() => toast.push('Demo action', 'ok')}>New project</Button>}
          />
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
