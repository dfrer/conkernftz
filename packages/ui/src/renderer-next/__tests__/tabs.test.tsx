import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Tabs, TabPanel } from '../components/Tabs';

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta', badge: 3 },
  { id: 'c', label: 'Gamma' },
];

afterEach(cleanup);

describe('Tabs', () => {
  it('marks the active tab and roving tabindex per WAI-ARIA', () => {
    const { getByRole } = render(<Tabs tabs={tabs} active="b" onChange={() => {}} ariaLabel="Sections" />);
    const beta = getByRole('tab', { name: 'Beta 3' });
    expect(beta.getAttribute('aria-selected')).toBe('true');
    expect(beta.getAttribute('tabindex')).toBe('0');
    expect(getByRole('tab', { name: 'Alpha' }).getAttribute('tabindex')).toBe('-1');
  });

  it('selects on click', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Tabs tabs={tabs} active="a" onChange={onChange} ariaLabel="Sections" />);
    fireEvent.click(getByRole('tab', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('arrow keys move selection and wrap around', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Tabs tabs={tabs} active="a" onChange={onChange} ariaLabel="Sections" />);
    fireEvent.keyDown(getByRole('tab', { name: 'Alpha' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    // wrap: from the first tab, ArrowLeft goes to the last.
    fireEvent.keyDown(getByRole('tab', { name: 'Alpha' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('Home/End jump to the first/last tab', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Tabs tabs={tabs} active="b" onChange={onChange} ariaLabel="Sections" />);
    fireEvent.keyDown(getByRole('tab', { name: 'Beta 3' }), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(getByRole('tab', { name: 'Beta 3' }), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('TabPanel renders children only when active', () => {
    const { queryByText, rerender } = render(
      <TabPanel id="a" active="b">
        secret
      </TabPanel>,
    );
    expect(queryByText('secret')).toBeNull();
    rerender(
      <TabPanel id="a" active="a">
        secret
      </TabPanel>,
    );
    expect(queryByText('secret')).toBeTruthy();
  });
});
