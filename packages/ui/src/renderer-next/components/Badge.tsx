import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export type BadgeTone = 'default' | 'accent' | 'ok' | 'danger' | 'info' | 'warn';

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx('badge', tone !== 'default' && `badge--${tone}`)}>{children}</span>;
}
