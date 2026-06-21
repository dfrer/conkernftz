import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { RedactionStamp } from '../components/RedactionStamp';
import { bridge } from '../lib/bridge';

// Ordered to match the pipeline nav (Projects → Design → … → Launch), then the utility stages.
const STAGES: Array<[string, string]> = [
  ['Projects', 'Create a fresh collection (starter config + layer folders) or open an existing project folder.'],
  ['Design', 'Basics, layers, effects and rules — in tabs. Expand a layer to browse its traits with drop-odds; each row shows a rarity bar.'],
  ['Preview', 'Render a fresh random set live from the engine. Set a seed to reproduce a set; click a tile to inspect it full-size.'],
  ['Build', 'Generate the full collection (images + metadata) with progress + pause/stop, a rarity report, and an output gallery of the editions.'],
  ['Publish', 'Upload to local / pinata / irys, then mint on Solana or EVM. The readiness strip shows what’s built and uploaded.'],
  ['Mint FX', 'Design the pack-opening / card-reveal animation collectors see when they mint.'],
  ['Site', 'Build a deployable mint site from blocks (or a starter template); preview locally or deploy to your own host.'],
  ['Launch', 'Deploy and operate the on-chain mint contract without a terminal — status, signing (key file / WalletConnect / browser console), sale setup, allowlist, reveal and withdraw.'],
  ['Packs', 'App-level library of pack & card-back art, shared across every project and used by Mint FX.'],
  ['Fal AI', 'Generate art or video with fal.ai models and save results into the project’s fal/ folder.'],
  ['Settings', 'Theme + accent, and the project’s storage and chain configuration.'],
];

export function HelpScreen() {
  const open = (url: string) => bridge()?.openExternal(url);
  return (
    <div className="stack stagger">
      <StageHeader kicker="SYSTEM // MANUAL" title="Help" />

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
            <strong>CONKERNFTZ</strong> is an NFT art foundry for building and launching collections — compose
            layer-based generative art, enforce rules, preview, build editions with metadata, design the mint
            experience, and deploy on-chain.
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
