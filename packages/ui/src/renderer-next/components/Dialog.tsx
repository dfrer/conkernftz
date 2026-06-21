import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  // Keep onClose current without re-running the focus-trap effect on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Modal focus management: on open, remember the trigger and move focus into the dialog; trap
  // Tab/Shift+Tab within it (aria-modal alone doesn't stop keyboard from reaching the background);
  // on close, restore focus to the trigger. Escape still closes.
  useEffect(() => {
    if (!open) return;
    prevFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    const node = dialogRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
        : [];
    (focusables()[0] ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        node?.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const inside = node?.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus.current?.focus?.();
    };
    // onClose is read via onCloseRef so the trap is set up once per open, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3 className="panel-title">{title}</h3>
          <Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
