import { FieldLabel } from './FormField';

interface Props {
  labelKey: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

export default function TextAreaField({ labelKey, value, onChange, rows = 3, placeholder }: Props) {
  return (
    <label className="form-field">
      <FieldLabel labelKey={labelKey} />
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="textarea-input"
      />
    </label>
  );
}

export function NotesField(props: Props) {
  return <TextAreaField {...props} labelKey="common.notes" />;
}
