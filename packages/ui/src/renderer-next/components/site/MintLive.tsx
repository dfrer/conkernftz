import { useState, type ReactElement } from 'react';
import { formatEther } from 'viem';
import { planMint, buildMintCall, explorerTxUrl, type MintPlan } from '@conkernftz/chain-evm';
import type { MintConfig } from '../../lib/site';
import {
  getInjectedProvider,
  connect,
  ensureChain,
  readSale,
  submitMint,
  parseWalletError,
} from '../../lib/mintWeb3';

/**
 * Non-custodial live-mint widget for the generated site. Connects an injected wallet, reads sale
 * state, shows eligibility (phase, price, allowance) via the tested `planMint`, and submits a mint
 * the wallet signs. Funds-affecting math lives in `@conkernftz/chain-evm`; this is the view + the
 * wallet I/O. Renders only when the site has a configured launch contract.
 */

type Status = 'idle' | 'connecting' | 'loading' | 'ready' | 'minting' | 'done' | 'error';

export function MintLive({ chainId, rpcUrl, contractAddress, allowlist }: MintConfig): ReactElement {
  const [status, setStatus] = useState<Status>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [plan, setPlan] = useState<MintPlan | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const provider = getInjectedProvider();
  if (!provider) {
    return (
      <div className="mint-live mint-live--nowallet" role="note">
        Install a browser wallet (e.g. MetaMask) to mint.
      </div>
    );
  }

  async function loadPlan(addr: string): Promise<void> {
    const sale = await readSale(rpcUrl, chainId, contractAddress, addr);
    const p = planMint({ sale, address: addr, allowlist, wallet: sale.wallet });
    setPlan(p);
    setQty(p.maxMintable > 0 ? 1 : 0);
  }

  async function onConnect(): Promise<void> {
    setError(null);
    setStatus('connecting');
    try {
      const { address: addr } = await connect(provider!);
      await ensureChain(provider!, chainId, rpcUrl);
      setAddress(addr);
      setStatus('loading');
      await loadPlan(addr);
      setStatus('ready');
    } catch (e) {
      setError(parseWalletError(e));
      setStatus('error');
    }
  }

  async function onMint(): Promise<void> {
    if (!plan || !address) return;
    setError(null);
    setStatus('minting');
    try {
      const call = buildMintCall(plan, qty);
      const hash = await submitMint(provider!, address, contractAddress, call);
      setTxHash(hash);
      setStatus('done');
    } catch (e) {
      setError(parseWalletError(e));
      setStatus('error');
    }
  }

  if (status === 'idle' || (!address && status !== 'connecting')) {
    return (
      <div className="mint-live">
        <button type="button" className="mint-live-btn" onClick={onConnect}>
          Connect wallet
        </button>
      </div>
    );
  }

  if (status === 'connecting' || status === 'loading') {
    return <div className="mint-live mint-live--busy">Connecting…</div>;
  }

  if (status === 'done' && txHash) {
    const url = explorerTxUrl(chainId, txHash);
    return (
      <div className="mint-live mint-live--done" role="status">
        <p>Mint submitted! 🎉</p>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="mint-live-link">
            View transaction
          </a>
        ) : (
          <code className="mint-live-tx">{txHash}</code>
        )}
      </div>
    );
  }

  const price = plan ? formatEther(plan.unitPriceWei) : '0';
  const max = plan?.maxMintable ?? 0;

  return (
    <div className="mint-live" data-phase={plan?.phase}>
      {plan ? (
        <p className="mint-live-status">
          Phase: <strong>{plan.phase}</strong> · {price} ETH each
        </p>
      ) : null}

      {plan && plan.canMint ? (
        <div className="mint-live-controls">
          <label className="mint-live-qty">
            Qty
            <input
              type="number"
              min={1}
              max={max}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
            />
            <span className="mint-live-max">/ {max} max</span>
          </label>
          <button
            type="button"
            className="mint-live-btn"
            onClick={onMint}
            disabled={status === 'minting' || qty < 1}
          >
            {status === 'minting' ? 'Confirm in wallet…' : `Mint ${qty}`}
          </button>
        </div>
      ) : (
        <p className="mint-live-reason">{plan?.reason ?? 'Minting is not available right now.'}</p>
      )}

      {error ? (
        <p className="mint-live-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
