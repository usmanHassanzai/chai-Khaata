import { PageTitle } from '../i18n/useLabel';
import AdminOrgTabs from '../components/AdminOrgTabs';
import PageBanner from '../components/PageBanner';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';

export default function AdminApprovals() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="page admin-approvals-page">
        <PageBanner titleKey="auth.adminUsers" subtitle="Admin only" icon="✅" accent="gold" />
        <PageTitle k="auth.adminUsers" />
        <section className="card">
          <p className="settings-note">
            <Label k="auth.adminOnly" variant="compact" />
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page admin-approvals-page">
      <PageBanner
        titleKey="auth.adminUsers"
        subtitle="Each department carries equal weight across the organization"
        icon="✅"
        accent="gold"
      />
      <PageTitle k="auth.adminUsers" />
      <AdminOrgTabs />
    </div>
  );
}
