import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge } from '../lib/bridge';
import { useProject } from '../state/project';
import { useTheme, type Accent, type Theme } from '../theme/ThemeProvider';

interface StorageCfg {
  provider?: string;
  pinata?: { jwt?: string; gateway?: string };
  irys?: { token?: string; node?: string; keyPath?: string; rpcUrl?: string };
  local?: { outDir?: string; gatewayBase?: string };
  [k: string]: unknown;
}
interface ChainCfg {
  target?: string;
  solana?: { cluster?: string; rpcUrl?: string; walletKeypairPath?: string; sellerFeeBasisPoints?: number };
  evm?: { chainId?: number; rpcUrl?: string; privateKeyPath?: string; contractAddress?: string; baseUri?: string };
  [k: string]: unknown;
}

export function SettingsScreen() {
  const { project, config, dirty, save, updateConfig } = useProject();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const toast = useToast();

  const editStorage = (fn: (s: StorageCfg) => void) =>
    updateConfig((d) => {
      const s = (d.storage ?? {}) as StorageCfg;
      fn(s);
      d.storage = s;
    });
  const editChain = (fn: (c: ChainCfg) => void) =>
    updateConfig((d) => {
      const c = (d.chain ?? {}) as ChainCfg;
      fn(c);
      d.chain = c;
    });
  const onSave = async () => {
    const ok = await save();
    toast.push(ok ? 'Settings saved' : 'Save failed', ok ? 'ok' : 'danger');
  };

  const storage = (config?.storage ?? {}) as StorageCfg;
  const chain = (config?.chain ?? {}) as ChainCfg;
  const provider = storage.provider ?? 'local';
  const target = chain.target ?? 'solana';
  const outDir = String((config?.export as { outDir?: string } | undefined)?.outDir ?? 'build');

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="SYSTEM // CONFIG"
        title="Settings"
        actions={
          config ? (
            <div className="row">
              {dirty ? <Badge tone="accent">UNSAVED</Badge> : null}
              <Button variant="primary" disabled={!dirty} onClick={onSave}>
                Save config
              </Button>
            </div>
          ) : undefined
        }
      />

      <Panel title="Appearance">
        <div className="grid cols-auto">
          <Field label="Theme">
            <Select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Theme">
              <option value="dark">dark · ink</option>
              <option value="light">light · manila</option>
            </Select>
          </Field>
          <Field label="Accent">
            <Select value={accent} onChange={(e) => setAccent(e.target.value as Accent)} aria-label="Accent">
              <option value="amber">amber (instrument)</option>
              <option value="cyan">cyan</option>
              <option value="magenta">magenta</option>
              <option value="lime">lime</option>
            </Select>
          </Field>
        </div>
      </Panel>

      {!project || !config ? (
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to edit its storage and chain settings." />
      ) : (
        <>
          <Panel title="Storage">
            <div className="grid cols-auto">
              <Field label="Provider">
                <Select value={provider} onChange={(e) => editStorage((s) => (s.provider = e.target.value))} aria-label="Storage provider">
                  <option value="local">local</option>
                  <option value="pinata">pinata (IPFS)</option>
                  <option value="irys">irys (Arweave)</option>
                </Select>
              </Field>
              {provider === 'pinata' ? (
                <>
                  <Field label="Pinata JWT">
                    <Input
                      type="password"
                      value={storage.pinata?.jwt ?? ''}
                      onChange={(e) => editStorage((s) => (s.pinata = { ...(s.pinata ?? {}), jwt: e.target.value }))}
                      placeholder="eyJ…"
                    />
                  </Field>
                  <Field label="Gateway">
                    <Input
                      value={storage.pinata?.gateway ?? ''}
                      onChange={(e) => editStorage((s) => (s.pinata = { ...(s.pinata ?? {}), gateway: e.target.value }))}
                      placeholder="https://gateway.pinata.cloud"
                    />
                  </Field>
                </>
              ) : null}
              {provider === 'irys' ? (
                <>
                  <Field label="Token">
                    <Input value={storage.irys?.token ?? ''} onChange={(e) => editStorage((s) => (s.irys = { ...(s.irys ?? {}), token: e.target.value }))} placeholder="solana / ethereum" />
                  </Field>
                  <Field label="Node">
                    <Input value={storage.irys?.node ?? ''} onChange={(e) => editStorage((s) => (s.irys = { ...(s.irys ?? {}), node: e.target.value }))} placeholder="https://node1.irys.xyz" />
                  </Field>
                  <Field label="Key path">
                    <Input value={storage.irys?.keyPath ?? ''} onChange={(e) => editStorage((s) => (s.irys = { ...(s.irys ?? {}), keyPath: e.target.value }))} placeholder="./keys/irys.json" />
                  </Field>
                  <Field label="RPC URL">
                    <Input value={storage.irys?.rpcUrl ?? ''} onChange={(e) => editStorage((s) => (s.irys = { ...(s.irys ?? {}), rpcUrl: e.target.value }))} />
                  </Field>
                </>
              ) : null}
              {provider === 'local' ? (
                <>
                  <Field label="Out dir">
                    <Input value={storage.local?.outDir ?? ''} onChange={(e) => editStorage((s) => (s.local = { ...(s.local ?? {}), outDir: e.target.value }))} placeholder="cids" />
                  </Field>
                  <Field label="Gateway base">
                    <Input value={storage.local?.gatewayBase ?? ''} onChange={(e) => editStorage((s) => (s.local = { ...(s.local ?? {}), gatewayBase: e.target.value }))} placeholder="file:// or https://…" />
                  </Field>
                </>
              ) : null}
            </div>
            <span className="label muted" style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
              Secrets are stored in <code>foundry.config.json</code> / referenced key files — keep them out of source control.
            </span>
          </Panel>

          <Panel title="Chain">
            <div className="grid cols-auto">
              <Field label="Target">
                <Select value={target} onChange={(e) => editChain((c) => (c.target = e.target.value))} aria-label="Chain target">
                  <option value="solana">solana</option>
                  <option value="evm">evm</option>
                </Select>
              </Field>
              {target === 'solana' ? (
                <>
                  <Field label="Cluster">
                    <Select
                      value={chain.solana?.cluster ?? 'devnet'}
                      onChange={(e) => editChain((c) => (c.solana = { ...(c.solana ?? {}), cluster: e.target.value }))}
                      aria-label="Solana cluster"
                    >
                      <option value="devnet">devnet</option>
                      <option value="testnet">testnet</option>
                      <option value="mainnet-beta">mainnet-beta</option>
                    </Select>
                  </Field>
                  <Field label="RPC URL">
                    <Input value={chain.solana?.rpcUrl ?? ''} onChange={(e) => editChain((c) => (c.solana = { ...(c.solana ?? {}), rpcUrl: e.target.value }))} />
                  </Field>
                  <Field label="Wallet keypair path">
                    <Input
                      value={chain.solana?.walletKeypairPath ?? ''}
                      onChange={(e) => editChain((c) => (c.solana = { ...(c.solana ?? {}), walletKeypairPath: e.target.value }))}
                      placeholder="./keys/solana.json"
                    />
                  </Field>
                  <Field label="Royalty (bps)">
                    <Input
                      type="number"
                      value={chain.solana?.sellerFeeBasisPoints ?? ''}
                      onChange={(e) => editChain((c) => (c.solana = { ...(c.solana ?? {}), sellerFeeBasisPoints: Number(e.target.value) || 0 }))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Chain ID">
                    <Input type="number" value={chain.evm?.chainId ?? ''} onChange={(e) => editChain((c) => (c.evm = { ...(c.evm ?? {}), chainId: Number(e.target.value) || 0 }))} />
                  </Field>
                  <Field label="RPC URL">
                    <Input value={chain.evm?.rpcUrl ?? ''} onChange={(e) => editChain((c) => (c.evm = { ...(c.evm ?? {}), rpcUrl: e.target.value }))} />
                  </Field>
                  <Field label="Private key path">
                    <Input value={chain.evm?.privateKeyPath ?? ''} onChange={(e) => editChain((c) => (c.evm = { ...(c.evm ?? {}), privateKeyPath: e.target.value }))} placeholder="./keys/evm.json" />
                  </Field>
                  <Field label="Contract address">
                    <Input value={chain.evm?.contractAddress ?? ''} onChange={(e) => editChain((c) => (c.evm = { ...(c.evm ?? {}), contractAddress: e.target.value }))} />
                  </Field>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Project">
            <div className="stack">
              <span className="mono muted" style={{ wordBreak: 'break-all' }}>
                {project.dir}
              </span>
              <div className="row">
                <Button size="sm" onClick={() => bridge()?.openInExplorer('.')}>
                  Open project folder
                </Button>
                <Button size="sm" onClick={() => bridge()?.openInExplorer(outDir)}>
                  Open build folder
                </Button>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
