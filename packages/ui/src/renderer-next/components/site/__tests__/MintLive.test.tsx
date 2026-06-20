import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MintLive } from '../MintLive';
import type { MintConfig } from '../../../lib/site';

const cfg: MintConfig = {
  chainId: 84532, // base-sepolia
  rpcUrl: 'https://sepolia.base.org',
  contractAddress: '0x00000000000000000000000000000000000000cc',
};

afterEach(() => {
  cleanup();
  delete (globalThis as { ethereum?: unknown }).ethereum;
});

describe('MintLive', () => {
  it('prompts to install a wallet when no injected provider is present', () => {
    render(<MintLive {...cfg} />);
    expect(screen.getByText(/install a browser wallet/i)).toBeTruthy();
  });

  it('shows a Connect wallet button when an injected provider exists', () => {
    (globalThis as { ethereum?: unknown }).ethereum = { request: vi.fn() };
    render(<MintLive {...cfg} />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeTruthy();
  });
});
