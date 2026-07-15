import { PageTitle } from '../i18n/useLabel';
import AdminAllUsersPanel from '../components/AdminAllUsersPanel';
import AdminUsersPanel from '../components/AdminUsersPanel';
import AdminPaymentProofsPanel from '../components/AdminPaymentProofsPanel';
import PageBanner from '../components/PageBanner';
import { AdminUsersProvider } from '../context/AdminUsersContext';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';

export default function AdminApprovals() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="page">
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
    <AdminUsersProvider>
      <div className="page">
        <PageBanner titleKey="auth.adminUsers" subtitle="Approve users & payment proofs" icon="✅" accent="gold" />
        <PageTitle k="auth.adminUsers" />
        <AdminPaymentProofsPanel />
        <AdminUsersPanel />
        <AdminAllUsersPanel />
      </div>
    </AdminUsersProvider>
  );
}
