import { Label, useLabel } from '../i18n/useLabel';

interface Props {
  labelKey: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
}

export default function FormField({
  labelKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
  step,
}: Props) {
  return (
    <label className="form-field">
      <span className="field-label">
        <Label k={labelKey} variant="stacked" />
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
      />
    </label>
  );
}

export function ReadOnlyField({ labelKey, value }: { labelKey: string; value: string }) {
  return (
    <div className="form-field readonly">
      <span className="field-label">
        <Label k={labelKey} variant="stacked" />
      </span>
      <span className="readonly-value">{value}</span>
    </div>
  );
}

export function FieldLabel({ labelKey }: { labelKey: string }) {
  return (
    <span className="field-label">
      <Label k={labelKey} variant="stacked" />
    </span>
  );
}

export { useLabel };
