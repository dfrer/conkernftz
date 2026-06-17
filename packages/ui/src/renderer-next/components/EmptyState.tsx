import type { ReactNode } from 'react';

export function EmptyState({
  code = 'NO DATA',
  title,
  hint,
  action,
}: {
  code?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">▮ {code}</div>
      <div className="panel-title">{title}</div>
      {hint ? (
        <div className="muted" style={{ maxWidth: 420 }}>
          {hint}
        </div>
      ) : null}
      {action}
    </div>
  );
}
