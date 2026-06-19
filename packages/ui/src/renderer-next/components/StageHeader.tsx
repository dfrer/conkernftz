import type { ReactNode } from 'react';

/**
 * The standard page header for every stage: a monospace kicker over the display title,
 * with optional right-aligned actions. One source of truth so every screen's header
 * stays structurally and visually identical.
 */
export function StageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="main-head">
      <div>
        <div className="label main-kicker">{kicker}</div>
        <h1 className="main-title">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
