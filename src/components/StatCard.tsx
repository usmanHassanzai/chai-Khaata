import type { CSSProperties } from 'react';
import { Label } from '../i18n/useLabel';

const ICONS: Record<string, string> = {
  green: '💹',
  amber: '✨',
  red: '⚠️',
  blue: '📈',
  brown: '📦',
};

const TEA_BG: Record<string, string> = {
  green: '/images/tea/green-mint-chai.jpg',
  amber: '/images/tea/kashmiri-chai.jpg',
  red: '/images/tea/sada-chai.jpg',
  blue: '/images/tea/karak-chai.jpg',
  brown: '/images/tea/tea-leaves.svg',
};

interface StatCardProps {
  labelKey: string;
  value: string;
  accent?: 'green' | 'amber' | 'red' | 'blue' | 'brown';
  delay?: number;
  size?: 'default' | 'compact';
}

export default function StatCard({
  labelKey,
  value,
  accent = 'green',
  delay = 0,
  size = 'default',
}: StatCardProps) {
  return (
    <div
      className={`stat-card stat-${accent} stat-card-premium stat-card-pro animate-fade-in-up${size === 'compact' ? ' stat-card-compact' : ''}`}
      style={{
        animationDelay: `${delay}ms`,
        '--stat-tea-bg': `url(${TEA_BG[accent]})`,
      } as CSSProperties}
    >
      <div className="stat-card-tea-bg" aria-hidden />
      <div className="stat-card-top">
        <span className="stat-icon" aria-hidden>
          {ICONS[accent] ?? '📊'}
        </span>
        <span className="stat-label">
          <Label k={labelKey} variant="stacked" />
        </span>
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}
