import { useEffect, type ReactNode } from 'react';
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
