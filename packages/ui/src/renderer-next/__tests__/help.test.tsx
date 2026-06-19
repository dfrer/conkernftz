import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HelpScreen } from '../screens/HelpScreen';

afterEach(cleanup);

describe('HelpScreen field manual', () => {
  it('documents every current stage', () => {
    const { getByText } = render(<HelpScreen />);
    for (const stage of ['Projects', 'Design', 'Preview', 'Build', 'Mint FX', 'Publish', 'Site', 'Fal AI', 'Settings']) {
      expect(getByText(stage)).toBeTruthy();
    }
  });

  it('does not carry the stale "classic UI / opt-in" note (legacy renderer was removed at cutover)', () => {
    const { queryByText } = render(<HelpScreen />);
    expect(queryByText(/classic UI/i)).toBeNull();
    expect(queryByText(/start:next/i)).toBeNull();
  });
});
