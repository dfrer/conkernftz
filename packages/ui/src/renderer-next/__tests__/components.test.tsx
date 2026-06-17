import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Button } from '../components/Button';

// Not using Vitest globals, so RTL's automatic afterEach cleanup isn't registered;
// unmount between tests so accumulated DOM doesn't break role/text queries.
afterEach(cleanup);
import { Dialog } from '../components/Dialog';
import { RedactionStamp } from '../components/RedactionStamp';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

describe('Button', () => {
  it('fires onClick and applies the variant class', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button variant="primary" onClick={onClick}>
        Go
      </Button>,
    );
    const btn = getByRole('button', { name: 'Go' });
    expect(btn.className).toContain('btn--primary');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog', () => {
  it('renders its body only when open', () => {
    const { queryByText, rerender } = render(
      <Dialog open={false} title="T" onClose={() => undefined}>
        Body
      </Dialog>,
    );
    expect(queryByText('Body')).toBeNull();
    rerender(
      <Dialog open title="T" onClose={() => undefined}>
        Body
      </Dialog>,
    );
    expect(queryByText('Body')).toBeTruthy();
  });
});

describe('RedactionStamp', () => {
  it('reveals the agency name on click (easter egg)', () => {
    const { getByRole, queryByText } = render(<RedactionStamp />);
    expect(queryByText('NORTHAMERICANSURVEILLANCEASSOCIATION')).toBeNull();
    fireEvent.click(getByRole('button'));
    expect(queryByText('NORTHAMERICANSURVEILLANCEASSOCIATION')).toBeTruthy();
  });
});

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      theme:{theme}
    </button>
  );
}

describe('ThemeProvider', () => {
  it('toggles theme and reflects it on the document element', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    const btn = getByRole('button');
    expect(btn.textContent).toContain('dark');
    fireEvent.click(btn);
    expect(btn.textContent).toContain('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
