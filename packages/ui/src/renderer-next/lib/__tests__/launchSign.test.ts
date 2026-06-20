import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, parseEther } from 'viem';
import { conkernftzLaunchAbi, conkernftzLaunchBytecode } from '@conkernftz/chain-evm';
import {
  buildDeployData,
  callSetCaps,
  callSetPrices,
  callSetPhase,
  callReveal,
  callSetAllowlistRoot,
  phaseEnum,
  walletSend,
  walletDeploy,
  type Eip1193Provider,
  type DeployInputs,
} from '../launchSign';

const inputs: DeployInputs = {
  name: 'Crust',
  symbol: 'CRST',
  maxSupply: 100,
  placeholderUri: 'ipfs://ph',
  treasury: '0x00000000000000000000000000000000000000cc',
  royaltyBps: 500,
};

const decode = (data: `0x${string}`) =>
  decodeFunctionData({ abi: conkernftzLaunchAbi, data });

describe('phaseEnum', () => {
  it('maps names to the contract enum', () => {
    expect(phaseEnum('closed')).toBe(0);
    expect(phaseEnum('allowlist')).toBe(1);
    expect(phaseEnum('public')).toBe(2);
  });
});

describe('buildDeployData', () => {
  it('prefixes the contract bytecode and appends encoded constructor args', () => {
    const data = buildDeployData(inputs);
    expect(data.startsWith(conkernftzLaunchBytecode)).toBe(true);
    expect(data.length).toBeGreaterThan(conkernftzLaunchBytecode.length); // ctor args appended
  });
});

describe('admin calldata round-trips (decode back to the intended args)', () => {
  it('setCaps', () => {
    const d = decode(callSetCaps(5, 3));
    expect(d.functionName).toBe('setCaps');
    expect(d.args).toEqual([5n, 3n]);
  });

  it('setPrices (ETH → wei)', () => {
    const d = decode(callSetPrices('0', '0.001'));
    expect(d.functionName).toBe('setPrices');
    expect(d.args).toEqual([0n, parseEther('0.001')]);
  });

  it('setPhase', () => {
    const d = decode(callSetPhase('public'));
    expect(d.functionName).toBe('setPhase');
    expect(d.args).toEqual([2]);
  });

  it('reveal', () => {
    const d = decode(callReveal('ipfs://cid/'));
    expect(d.functionName).toBe('reveal');
    expect(d.args).toEqual(['ipfs://cid/']);
  });

  it('setAllowlistRoot', () => {
    const root = `0x${'ab'.repeat(32)}` as `0x${string}`;
    const d = decode(callSetAllowlistRoot(root));
    expect(d.functionName).toBe('setAllowlistRoot');
    expect(d.args).toEqual([root]);
  });
});

describe('wallet senders use eth_sendTransaction', () => {
  const from = '0x00000000000000000000000000000000000000a1';
  const to = '0x00000000000000000000000000000000000000cc';

  it('walletSend forwards to/data/value', async () => {
    const request = vi.fn().mockResolvedValue('0xhash');
    const provider: Eip1193Provider = { request };
    const hash = await walletSend(provider, from, to, callSetPhase('public'), 0n);
    expect(hash).toBe('0xhash');
    const [{ method, params }] = request.mock.calls[0];
    expect(method).toBe('eth_sendTransaction');
    expect((params[0] as { to: string }).to).toBe(to);
    expect((params[0] as { value: string }).value).toBe('0x0');
  });

  it('walletDeploy sends a creation tx with no `to`', async () => {
    const request = vi.fn().mockResolvedValue('0xdeploytx');
    const provider: Eip1193Provider = { request };
    const hash = await walletDeploy(provider, from, inputs);
    expect(hash).toBe('0xdeploytx');
    const sent = request.mock.calls[0][0].params[0] as { to?: string; data: string };
    expect(sent.to).toBeUndefined();
    expect(sent.data.startsWith(conkernftzLaunchBytecode)).toBe(true);
  });
});
