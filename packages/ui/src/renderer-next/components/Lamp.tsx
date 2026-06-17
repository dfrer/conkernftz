import { cx } from '../lib/cx';

export type LampState = 'off' | 'on' | 'ok' | 'danger';

export function Lamp({ state = 'off', pulse }: { state?: LampState; pulse?: boolean }) {
  return <span className={cx('lamp', state !== 'off' && `lamp--${state}`, pulse && 'lamp--pulse')} aria-hidden />;
}
