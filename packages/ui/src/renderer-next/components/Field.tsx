import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  /** Helper text under the control. Hidden when `error` is set. */
  hint?: string;
  /** Error text under the control (danger-toned); pair with `invalid` on the control. */
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="field-msg field-msg--error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-msg">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx('input', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; children?: ReactNode }) {
  return (
    <select className={cx('select', className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}
