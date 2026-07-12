import { Label } from '../i18n/useLabel';

const ICONS: Record<string, string> = {
  green: '💹',
  amber: '✨',
  red: '⚠️',
  blue: '📈',
  brown: '📦',
};

interface StatCardProps {
  labelKey: string;
  value: string;
  accent?: 'green' | 'amber' | 'red' | 'blue' | 'brown';
  delay?: number;
}

export default function StatCard({ labelKey, value, accent = 'green', delay = 0 }: StatCardProps) {
  return (
    <div
      className={`stat-card stat-${accent} animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="stat-card-top">
        <span className="stat-icon">{ICONS[accent] ?? '📊'}</span>
        <span className="stat-label">
          <Label k={labelKey} variant="stacked" />
        </span>
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}
