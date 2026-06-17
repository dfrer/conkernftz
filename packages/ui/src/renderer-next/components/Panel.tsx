import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  inset?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, actions, inset, className, children }: PanelProps) {
  return (
    <section className={cx('panel', inset && 'panel--inset', className)}>
      {(title || actions) && (
        <div className="panel-head">
          {title ? <h3 className="panel-title">{title}</h3> : <span />}
          {actions ? <div className="row wrap">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
