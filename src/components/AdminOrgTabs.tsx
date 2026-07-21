import { useState, type CSSProperties, type ReactNode } from 'react';
import { useAdminUsers } from '../context/AdminUsersContext';
import AdminAllUsersPanel from './AdminAllUsersPanel';
import AdminUsersPanel from './AdminUsersPanel';
import AdminPaymentProofsPanel from './AdminPaymentProofsPanel';

export type AdminOrgTabId = 'payments' | 'pending' | 'all';

type TabDef = {
  id: AdminOrgTabId;
  label: string;
  icon: string;
  count?: number;
};

type Props = {
  showStats?: boolean;
  defaultTab?: AdminOrgTabId;
};

function TabPanel({ active, id, children }: { active: boolean; id: string; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`admin-org-panel-${id}`}
      aria-labelledby={`admin-org-tab-${id}`}
      hidden={!active}
      className="admin-tab-panel"
    >
      {active ? children : null}
    </div>
  );
}

export default function AdminOrgTabs({ showStats = true, defaultTab = 'payments' }: Props) {
  const { counts } = useAdminUsers();
  const [tab, setTab] = useState<AdminOrgTabId>(defaultTab);
  const [paymentCount, setPaymentCount] = useState(0);

  const tabs: TabDef[] = [
    { id: 'payments', label: 'Payment proofs', icon: '💳', count: paymentCount },
    { id: 'pending', label: 'Pending users', icon: '⏳', count: counts.pending + counts.rejected },
    { id: 'all', label: 'All users', icon: '👥', count: counts.total },
  ];

  const tabStyle = { '--admin-tab-count': tabs.length } as CSSProperties;

  return (
    <>
      {showStats && (
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span className="admin-stat-icon">💳</span>
            <div>
              <strong>{paymentCount}</strong>
              <small>Payment proofs waiting</small>
            </div>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-icon">⏳</span>
            <div>
              <strong>{counts.pending}</strong>
              <small>Pending approval</small>
            </div>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-icon">✓</span>
            <div>
              <strong>{counts.approved}</strong>
              <small>Active subscribers</small>
            </div>
          </div>
        </div>
      )}

      <div className="admin-tabs admin-tabs-equal" role="tablist" aria-label="Admin departments" style={tabStyle}>
        {tabs.map((t, index) => {
          const base = Math.floor((100 / tabs.length) * 10) / 10;
          const weight = index === tabs.length - 1
            ? (100 - base * (tabs.length - 1)).toFixed(1)
            : base.toFixed(1);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`admin-org-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`admin-org-panel-${t.id}`}
              title={`${weight}% of organization`}
              className={`admin-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="admin-tab-icon">{t.icon}</span>
              <span className="admin-tab-label">{t.label}</span>
              <span className="admin-tab-weight">{weight}%</span>
              {(t.count ?? 0) > 0 && (
                <span className="admin-tab-badge">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="admin-tab-panels">
        <TabPanel active={tab === 'payments'} id="payments">
          <AdminPaymentProofsPanel onCountChange={setPaymentCount} />
        </TabPanel>
        <TabPanel active={tab === 'pending'} id="pending">
          <AdminUsersPanel />
        </TabPanel>
        <TabPanel active={tab === 'all'} id="all">
          <AdminAllUsersPanel />
        </TabPanel>
      </div>
    </>
  );
}
