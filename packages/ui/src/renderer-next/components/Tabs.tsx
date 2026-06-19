import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface TabDef {
  id: string;
  label: string;
  /** Optional trailing count/badge, e.g. layer count. */
  badge?: ReactNode;
}

/**
 * Accessible tablist (WAI-ARIA): roving tabindex + arrow/Home/End keyboard nav.
 * Controlled — the parent owns `active` and renders the matching tabpanel.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (i: number) => {
    const n = tabs.length;
    const idx = ((i % n) + n) % n;
    onChange(tabs[idx]!.id);
    refs.current[idx]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusTab(i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusTab(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusTab(0);
        break;
      case 'End':
        e.preventDefault();
        focusTab(tabs.length - 1);
        break;
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            className={cx('tab', isActive && 'tab--active')}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span>{t.label}</span>
            {t.badge != null ? <span className="tab__badge">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Wrapper that wires the WAI-ARIA tabpanel relationship and hides inactive panels. */
export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  const isActive = id === active;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={!isActive}>
      {isActive ? children : null}
    </div>
  );
}
