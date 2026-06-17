import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export function Badge({ tone = 'default', children }: { tone?: 'default' | 'accent' | 'ok'; children: ReactNode }) {
  return <span className={cx('badge', tone !== 'default' && `badge--${tone}`)}>{children}</span>;
}
