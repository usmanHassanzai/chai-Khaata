import { useRef, useState } from 'react';
import { compressImage } from '../utils/imageUtils';
import { FieldLabel } from './FormField';
import { useLabel } from '../i18n/useLabel';

interface Props {
  labelKey: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

export default function ImageUpload({ labelKey, value, onChange }: Props) {
  const l = useLabel();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      setError(l('common.imageError'));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="form-field image-upload-field">
      <FieldLabel labelKey={labelKey} />
      <div className="image-upload-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="image-input-hidden"
          onChange={handleFile}
        />
        <button type="button" className="btn sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? '...' : l('common.uploadImage')}
        </button>
        {value && (
          <button type="button" className="btn danger sm" onClick={() => onChange(undefined)}>
            {l('common.removeImage')}
          </button>
        )}
      </div>
      {error && <p className="error-msg sm">{error}</p>}
      {value && (
        <a href={value} target="_blank" rel="noreferrer" className="image-preview-link">
          <img src={value} alt="" className="image-preview" />
        </a>
      )}
    </div>
  );
}

export function ImageThumb({ src, alt }: { src?: string; alt?: string }) {
  if (!src) return <span className="no-image">—</span>;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="image-thumb-link">
      <img src={src} alt={alt ?? 'image'} className="image-thumb" />
    </a>
  );
}
