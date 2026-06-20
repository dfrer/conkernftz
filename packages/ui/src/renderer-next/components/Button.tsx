import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: boolean;
  /** Show a spinner, mark the button busy, and disable it while an action runs. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', icon, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size === 'sm' && 'btn--sm',
        icon && 'btn--icon',
        loading && 'btn--loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
