import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RedactionStamp } from '../components/RedactionStamp';
import { bridge } from '../lib/bridge';

const STAGES: Array<[string, string]> = [
  ['Projects', 'Create a fresh collection (starter config + layer folders) or open an existing project folder.'],
  ['Design', 'Basics, layers, effects and rules — in tabs. Expand a layer to browse its traits with drop-odds; each row shows a rarity bar.'],
  ['Preview', 'Render a fresh random set live from the engine. Set a seed to reproduce a set; click a tile to inspect it full-size.'],
  ['Build', 'Generate the full collection (images + metadata) with progress + pause/stop, a rarity report, and an output gallery of the editions.'],
  ['Mint FX', 'Design the pack-opening / card-reveal animation collectors see when they mint.'],
  ['Publish', 'Upload to local / pinata / irys, then mint on Solana or EVM. The readiness strip shows what’s built and uploaded.'],
  ['Site', 'Build a deployable mint site from blocks (or a starter template); preview locally or deploy to Vercel.'],
  ['Fal AI', 'Generate art or video with fal.ai models and save results into the project’s fal/ folder.'],
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
            On-chain writes default to testnet/devnet; mainnet stays gated behind explicit CLI flags. Keys and tokens
            live on this machine (in <code>foundry.config.json</code> or referenced key files) — keep them out of source
            control.
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
