import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../App';

describe('renderer-next app shell', () => {
  it('renders the brand and the projects stage', () => {
    const { getByText, getAllByText } = render(<App />);
    // Brand tagline is a single text node.
    expect(getByText('NFT Art Foundry')).toBeTruthy();
    // "Projects" appears in both the nav and the stage title.
    expect(getAllByText('Projects').length).toBeGreaterThan(0);
    // The instrument status bar reports bridge state (offline in tests).
    expect(getByText('OFFLINE')).toBeTruthy();
  });
});
