import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

const actions = [
  { to: '/dukaan', icon: '🏪', label: 'New Sale', color: '#2d6a4f' },
  { to: '/godaam', icon: '📦', label: 'Purchase', color: '#b87333' },
  { to: '/customers', icon: '👥', label: 'Customers', color: '#2563eb' },
  { to: '/stock', icon: '📋', label: 'Stock', color: '#7c3aed' },
] as const;

export default function QuickActions() {
  return (
    <nav className="quick-actions animate-fade-in-up stagger-3" aria-label="Quick actions">
      {actions.map((action, i) => (
        <Link
          key={action.to}
          to={action.to}
          className={`quick-action-card stagger-${i + 1}`}
          style={{ '--qa-color': action.color } as CSSProperties}
        >
          <span className="quick-action-icon">{action.icon}</span>
          <span className="quick-action-label">{action.label}</span>
        </Link>
      ))}
    </nav>
  );
}
