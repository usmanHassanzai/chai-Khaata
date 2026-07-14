import { Navigate, Outlet } from 'react-router-dom';
import AppLoading from './AppLoading';
import { useAuth } from '../context/AuthContext';

function isPaymentBlocked(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
  return user.role !== 'admin' && (user.paymentBlocked || (user.paymentDue ?? 0) > 0);
}

function isSubscriptionExpired(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
  return user.role !== 'admin' && Boolean(user.subscriptionExpired);
}

export default function ProtectedRoute() {
  const { user, loading, dbReady } = useAuth();

  if (loading || (user && !dbReady)) {
    return <AppLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isPaymentBlocked(user)) {
    return <Navigate to="/payment-due" replace />;
  }

  if (isSubscriptionExpired(user)) {
    return <Navigate to="/subscription-renew" replace />;
  }

  if (user.status !== 'approved' && user.role !== 'admin') {
    if (user.status === 'pending' && user.trialActive) {
      return <Outlet />;
    }
    return <Navigate to="/login" replace state={{ pending: user.status === 'pending' }} />;
  }

  return <Outlet />;
}
