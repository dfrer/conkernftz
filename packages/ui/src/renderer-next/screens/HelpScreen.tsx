import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RedactionStamp } from '../components/RedactionStamp';
import { bridge } from '../lib/bridge';

const STAGES: Array<[string, string]> = [
  ['Projects', 'Open or create a project — a folder with a foundry.config.json and layer assets.'],
  ['Design', 'Edit basics, layers, per-layer effects (blend + glow/stroke/shadow/…), and rules.'],
  ['Preview', 'Render a fresh random set of editions live from the engine.'],
  ['Build', 'Generate the full collection (images + metadata) with progress and a rarity report.'],
  ['Publish', 'Upload to irys / pinata / local, then mint on Solana or EVM.'],
  ['Settings', 'Theme + accent, and the project’s storage and chain configuration.'],
];

export function HelpScreen() {
  const open = (url: string) => bridge()?.openExternal(url);
  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">SYSTEM // MANUAL</div>
          <h1 className="main-title">Help</h1>
        </div>
      </div>

      <Panel title="Field manual">
        <div className="stack">
          {STAGES.map(([name, desc]) => (
            <div key={name} className="histo-row" style={{ gridTemplateColumns: '120px 1fr' }}>
              <span className="mono" style={{ color: 'var(--accent)' }}>
                {name}
              </span>
              <span className="muted">{desc}</span>
            </div>
          ))}
          <span className="label muted">
            On-chain writes default to testnet/devnet. The new UI is opt-in via <code>start:next</code>; the classic UI
            remains the default until cutover.
          </span>
        </div>
      </Panel>

      <Panel title="About">
        <div className="stack">
          <p style={{ margin: 0 }}>
            <strong>CONKERNFTZ</strong> is a creator toolkit for layer-based generative art and NFT collections —
            compose layers, enforce rules, preview, build editions with metadata, and publish on-chain.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Built and designed by <strong>Conker</strong>.
          </p>
          <div className="row wrap">
            <Button size="sm" onClick={() => open('https://twitter.com/conkernasa')}>
              Follow @conkernasa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => open('https://northamericansurveillanceassociation.com')}>
              northamericansurveillanceassociation.com
            </Button>
            <RedactionStamp />
          </div>
          <span className="label muted">Links open in your default browser.</span>
        </div>
      </Panel>
    </div>
  );
}
