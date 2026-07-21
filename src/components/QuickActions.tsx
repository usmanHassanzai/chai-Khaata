import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

const actions = [
  { to: '/dukaan', icon: '🏪', label: 'New Sale', hint: 'Record a sale', color: '#2d6a4f' },
  { to: '/godaam', icon: '📦', label: 'Purchase', hint: 'Stock in', color: '#b87333' },
  { to: '/customers', icon: '👥', label: 'Customers', hint: 'Dues & contacts', color: '#1e5a8a' },
  { to: '/stock', icon: '📋', label: 'Stock', hint: 'Inventory ledger', color: '#5c6b63' },
] as const;

export default function QuickActions() {
  return (
    <nav className="quick-actions quick-actions-pro animate-fade-in-up stagger-2" aria-label="Quick actions">
      {actions.map((action, i) => (
        <Link
          key={action.to}
          to={action.to}
          className={`quick-action-card stagger-${i + 1}`}
          style={{ '--qa-color': action.color } as CSSProperties}
        >
          <span className="quick-action-icon" aria-hidden>
            {action.icon}
          </span>
          <span className="quick-action-text">
            <span className="quick-action-label">{action.label}</span>
            <span className="quick-action-hint">{action.hint}</span>
          </span>
          <span className="quick-action-arrow" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}
