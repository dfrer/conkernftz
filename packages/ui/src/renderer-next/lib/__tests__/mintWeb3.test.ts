import { describe, it, expect } from 'vitest';
import type { MintCall } from '@conkernftz/chain-evm';
import {
  connect,
  ensureChain,
  encodeMintTx,
  submitMint,
  parseWalletError,
  type Eip1193Provider,
} from '../mintWeb3';

interface Call {
  method: string;
  params?: unknown[];
}

/** A scriptable EIP-1193 provider that records calls and dispatches by method. */
function mockProvider(handlers: Record<string, (params?: unknown[]) => unknown>): {
  provider: Eip1193Provider;
  calls: Call[];
} {
  const calls: Call[] = [];
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      calls.push({ method, params });
      const h = handlers[method];
      if (!h) throw new Error(`unhandled ${method}`);
      return h(params);
    },
  };
  return { provider, calls };
}

describe('connect', () => {
  it('returns the first account and the numeric chain id', async () => {
    const { provider } = mockProvider({
      eth_requestAccounts: () => ['0x00000000000000000000000000000000000000a1'],
      eth_chainId: () => '0x14a34', // 84532 base-sepolia
    });
    const res = await connect(provider);
    expect(res.address).toBe('0x00000000000000000000000000000000000000a1');
    expect(res.chainId).toBe(84532);
  });

  it('throws when the wallet returns no accounts', async () => {
    const { provider } = mockProvider({ eth_requestAccounts: () => [], eth_chainId: () => '0x1' });
    await expect(connect(provider)).rejects.toThrow(/No account/);
  });
});

describe('ensureChain', () => {
  it('switches to the target chain when the wallet knows it', async () => {
    const { provider, calls } = mockProvider({
      wallet_switchEthereumChain: () => null,
    });
    await ensureChain(provider, 84532);
    expect(calls[0]!.method).toBe('wallet_switchEthereumChain');
    expect((calls[0]!.params?.[0] as { chainId: string }).chainId).toBe('0x14a34');
  });

  it('adds the chain (EIP-3085) when the wallet does not know it (error 4902)', async () => {
    const { provider, calls } = mockProvider({
      wallet_switchEthereumChain: () => {
        throw { code: 4902 };
      },
      wallet_addEthereumChain: () => null,
    });
    await ensureChain(provider, 84532, 'https://my.rpc/');
    expect(calls.map((c) => c.method)).toEqual([
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
    ]);
    const added = calls[1]!.params?.[0] as { chainId: string; rpcUrls: string[] };
    expect(added.chainId).toBe('0x14a34');
    expect(added.rpcUrls).toEqual(['https://my.rpc/']);
  });

  it('rethrows non-4902 switch errors (e.g. user rejection)', async () => {
    const { provider } = mockProvider({
      wallet_switchEthereumChain: () => {
        throw { code: 4001 };
      },
    });
    await expect(ensureChain(provider, 84532)).rejects.toMatchObject({ code: 4001 });
  });
});

describe('encodeMintTx', () => {
  const from = '0x00000000000000000000000000000000000000a1';
  const to = '0x00000000000000000000000000000000000000cc';

  it('encodes a public mint with the exact hex value', () => {
    const call: MintCall = { functionName: 'publicMint', args: [2n], valueWei: 40_000_000_000_000_000n };
    const tx = encodeMintTx(call, from, to);
    expect(tx.from).toBe(from);
    expect(tx.to).toBe(to);
    expect(tx.data.startsWith('0x')).toBe(true);
    expect(tx.value).toBe(`0x${(40_000_000_000_000_000n).toString(16)}`);
  });

  it('encodes an allowlist mint (different selector than public)', () => {
    const pub = encodeMintTx({ functionName: 'publicMint', args: [1n], valueWei: 0n }, from, to);
    const al = encodeMintTx(
      { functionName: 'allowlistMint', args: [1n, 3n, []], valueWei: 0n },
      from,
      to,
    );
    expect(al.data.slice(0, 10)).not.toBe(pub.data.slice(0, 10)); // distinct 4-byte selectors
  });
});

describe('submitMint', () => {
  it('sends eth_sendTransaction with the encoded call and returns the hash', async () => {
    const { provider, calls } = mockProvider({
      eth_sendTransaction: () => '0xhash',
    });
    const call: MintCall = { functionName: 'publicMint', args: [1n], valueWei: 20_000_000_000_000_000n };
    const hash = await submitMint(provider, '0x00000000000000000000000000000000000000a1', '0x00000000000000000000000000000000000000cc', call);
    expect(hash).toBe('0xhash');
    expect(calls[0]!.method).toBe('eth_sendTransaction');
    const sent = calls[0]!.params?.[0] as { value: string; to: string };
    expect(sent.value).toBe(`0x${(20_000_000_000_000_000n).toString(16)}`);
  });
});

describe('parseWalletError', () => {
  it('maps known wallet error codes to friendly text', () => {
    expect(parseWalletError({ code: 4001 })).toMatch(/rejected/i);
    expect(parseWalletError({ code: 4902 })).toMatch(/network/i);
    expect(parseWalletError({ code: -32002 })).toMatch(/already pending/i);
  });

  it('detects insufficient funds and falls back to the message', () => {
    expect(parseWalletError(new Error('insufficient funds for gas'))).toMatch(/insufficient funds/i);
    expect(parseWalletError(new Error('boom'))).toBe('boom');
  });
});
