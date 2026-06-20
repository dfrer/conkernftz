import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToastProvider } from '../../components/Toast';
import { LaunchScreen } from '../LaunchScreen';
import type { LaunchStatus } from '../../lib/bridge';

const deployed: LaunchStatus = {
  configured: true,
  chainId: 84532,
  testnet: true,
  contractAddress: '0x3acce925b5074aa0d4bea7b3dcc329826adb9e67',
  phase: 'public',
  configLocked: true,
  totalMinted: '1',
  maxSupply: '100',
  allowlistPriceEth: '0',
  publicPriceEth: '0.001',
  publicWalletCap: '5',
  maxPerTx: '3',
  revealed: false,
  metadataFrozen: false,
  treasury: '0xbdCEa1b623b0148eAD0dC71702026e97333ea9eE',
  owner: '0xbdCEa1b623b0148eAD0dC71702026e97333ea9eE',
};

afterEach(() => {
  cleanup();
  delete (globalThis as { window?: { foundry?: unknown } }).window?.foundry;
  (window as unknown as { foundry?: unknown }).foundry = undefined;
});

const renderScreen = (): ReturnType<typeof render> =>
  render(
    <ToastProvider>
      <LaunchScreen />
    </ToastProvider>,
  );

describe('LaunchScreen', () => {
  it('tells the user the desktop app is required when not bridged', () => {
    renderScreen();
    expect(screen.getByText(/desktop app required/i)).toBeTruthy();
  });

  it('renders live status and the sale-setup panel for a deployed contract', async () => {
    (window as unknown as { foundry?: unknown }).foundry = {
      launchStatus: vi.fn().mockResolvedValue({ ok: true, json: deployed }),
    };
    renderScreen();
    // status reads asynchronously on mount
    expect(await screen.findByText(deployed.contractAddress!)).toBeTruthy();
    expect(screen.getByText(/sale setup/i)).toBeTruthy();
    expect(screen.getByText('1 / 100')).toBeTruthy();
    // public phase opened → config is locked
    expect(screen.getByText(/Prices & caps are locked/i)).toBeTruthy();
  });

  it('shows the deploy panel when no contract is deployed yet', async () => {
    (window as unknown as { foundry?: unknown }).foundry = {
      launchStatus: vi.fn().mockResolvedValue({ ok: true, json: { configured: false, chainId: 84532, testnet: true } }),
    };
    renderScreen();
    expect(await screen.findByText(/not deployed yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /deploy contract/i })).toBeTruthy();
  });
});
