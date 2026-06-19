import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StageHeader } from '../components/StageHeader';

afterEach(cleanup);

describe('StageHeader', () => {
  it('renders the kicker and title', () => {
    const { getByText, getByRole } = render(<StageHeader kicker="STAGE 02 // INSPECTION" title="Preview" />);
    expect(getByText('STAGE 02 // INSPECTION')).toBeTruthy();
    expect(getByRole('heading', { name: 'Preview', level: 1 })).toBeTruthy();
  });

  it('renders actions when provided', () => {
    const { getByText } = render(
      <StageHeader kicker="K" title="T" actions={<button type="button">Save</button>} />,
    );
    expect(getByText('Save')).toBeTruthy();
  });
});
