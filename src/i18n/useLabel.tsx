import { useEffect, useState } from 'react';
import {
  formatLabel,
  getLabel,
  getLabelMode,
  setLabelMode,
  type LabelMode,
  type LabelText,
} from './labels';

export type { LabelMode, LabelText };
export { getLabel, formatLabel, getLabelMode, setLabelMode };

export function useLabelMode(): LabelMode {
  const [mode, setMode] = useState(getLabelMode());

  useEffect(() => {
    const handler = () => setMode(getLabelMode());
    window.addEventListener('label-mode-change', handler);
    return () => window.removeEventListener('label-mode-change', handler);
  }, []);

  return mode;
}

export function useLabel() {
  const mode = useLabelMode();
  return (path: string, vars?: Record<string, string>) => formatLabel(getLabel(path), mode, vars);
}

interface LabelProps {
  k: string;
  vars?: Record<string, string>;
  className?: string;
  /** compact = single line; stacked = Urdu on top, English below */
  variant?: 'compact' | 'stacked';
}

export function Label({ k, vars, className = '', variant = 'stacked' }: LabelProps) {
  const mode = useLabelMode();
  const text = getLabel(k);

  let ur = text.ur;
  let en = text.en;
  let roman = text.roman ?? text.en;
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      ur = ur.replace(`{{${key}}}`, val);
      en = en.replace(`{{${key}}}`, val);
      roman = roman.replace(`{{${key}}}`, val);
    }
  }

  if (mode === 'en') {
    return <span className={className}>{en}</span>;
  }
  if (mode === 'ur') {
    return <span className={`${className} urdu-text`} dir="rtl">{ur}</span>;
  }
  if (mode === 'ur-roman') {
    return <span className={className}>{roman}</span>;
  }

  if (variant === 'compact') {
    return (
      <span className={`bilingual-compact ${className}`}>
        <span className="urdu-text" dir="rtl">{ur}</span>
        <span className="bilingual-sep">·</span>
        <span className="english-text">{en}</span>
      </span>
    );
  }

  return (
    <span className={`bilingual-stacked ${className}`}>
      <span className="urdu-text" dir="rtl">{ur}</span>
      <span className="english-text">{en}</span>
    </span>
  );
}

export function PageTitle({ k }: { k: string }) {
  return (
    <div className="page-header">
      <h2 className="page-title"><Label k={k} variant="stacked" /></h2>
    </div>
  );
}

export function SectionTitle({ k }: { k: string }) {
  return (
    <h3 className="section-title">
      <span className="section-title-bar" />
      <Label k={k} variant="stacked" />
    </h3>
  );
}
