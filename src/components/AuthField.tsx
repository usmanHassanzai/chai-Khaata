import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  icon?: string;
  hint?: ReactNode;
};

/** Styled auth input with optional leading icon. */
export default function AuthField({ label, icon, hint, className = '', ...inputProps }: Props) {
  return (
    <label className={`auth-field auth-field-pro ${className}`.trim()}>
      <span className="auth-field-label">{label}</span>
      <div className="auth-input-wrap">
        {icon && <span className="auth-input-icon" aria-hidden>{icon}</span>}
        <input {...inputProps} />
      </div>
      {hint && <span className="auth-field-hint">{hint}</span>}
    </label>
  );
}
