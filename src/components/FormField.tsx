import { Label } from '../i18n/useLabel';

interface Props {
  labelKey: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
  autoComplete?: string;
}

/** Compact single-line labels — easier for shop staff than stacked bilingual. */
export default function FormField({
  labelKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
  step,
  autoComplete,
}: Props) {
  return (
    <label className="form-field">
      <span className="field-label">
        <Label k={labelKey} variant="compact" />
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        autoComplete={autoComplete}
      />
    </label>
  );
}

export function ReadOnlyField({ labelKey, value }: { labelKey: string; value: string }) {
  return (
    <div className="form-field readonly">
      <span className="field-label">
        <Label k={labelKey} variant="compact" />
      </span>
      <span className="readonly-value">{value}</span>
    </div>
  );
}

export function FieldLabel({ labelKey }: { labelKey: string }) {
  return (
    <span className="field-label">
      <Label k={labelKey} variant="compact" />
    </span>
  );
}

export { useLabel } from '../i18n/useLabel';
