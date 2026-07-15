import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, authApi, getStoredToken, type AuthUser, type OtpRequest } from '../services/authApi';
import { useAuth } from './AuthContext';

type AdminCounts = {
  pending: number;
  rejected: number;
  approved: number;
  total: number;
};

type AdminUsersState = {
  users: AuthUser[];
  otpRequests: OtpRequest[];
  counts: AdminCounts;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const AdminUsersContext = createContext<AdminUsersState | null>(null);

const POLL_MS = 30_000;

function formatLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FORBIDDEN') return 'Admin access required. Log in with the admin account.';
    if (err.code === 'UNAUTHORIZED' || err.code === 'INVALID_TOKEN') return 'Session expired. Please log out and log in again.';
    if (err.code === 'TIMEOUT') return 'Server took too long loading users. Please retry.';
    if (err.code === 'DATABASE_ERROR') return err.message;
    return err.message;
  }
  return 'Could not load users.';
}

function countsFromUsers(users: AuthUser[]): AdminCounts {
  let pending = 0;
  let rejected = 0;
  let approved = 0;
  for (const user of users) {
    if (user.role === 'admin') continue;
    if (user.status === 'pending') pending += 1;
    else if (user.status === 'rejected') rejected += 1;
    else if (user.status === 'approved') approved += 1;
  }
  return { pending, rejected, approved, total: pending + rejected + approved };
}

export function AdminUsersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [otpRequests, setOtpRequests] = useState<OtpRequest[]>([]);
  const [counts, setCounts] = useState<AdminCounts>({ pending: 0, rejected: 0, approved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = async () => {
      if (user?.role !== 'admin') {
        setUsers([]);
        setOtpRequests([]);
        setCounts({ pending: 0, rejected: 0, approved: 0, total: 0 });
        setLoading(false);
        setError('Admin access required.');
        return;
      }

      if (!getStoredToken()) {
        setLoading(false);
        setError('Session expired. Please log in again.');
        return;
      }

      const silent = opts?.silent ?? hasLoadedRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        try {
          const dash = await authApi.adminDashboard({ includeAdmin: true });
          setUsers(dash.users);
          setCounts(dash.counts ?? countsFromUsers(dash.users));
          hasLoadedRef.current = true;
        } catch (dashErr) {
          if (
            dashErr instanceof ApiError
            && ['FORBIDDEN', 'UNAUTHORIZED', 'INVALID_TOKEN'].includes(dashErr.code)
          ) {
            throw dashErr;
          }
          const usersRes = await authApi.listUsers({ includeAdmin: true });
          setUsers(usersRes.users);
          setCounts(countsFromUsers(usersRes.users));
          hasLoadedRef.current = true;
          authApi.adminUsersSummary()
            .then((summaryRes) => setCounts(summaryRes))
            .catch(() => { /* keep counts derived from user list */ });
        }

        authApi.listOtpRequests()
          .then((otpRes) => setOtpRequests(otpRes.requests))
          .catch(() => { /* keep existing OTP rows on background refresh failure */ });
      } catch (err) {
        setError(formatLoadError(err));
        if (!silent) {
          setUsers([]);
          setOtpRequests([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        refreshInFlightRef.current = null;
      }
    };

    refreshInFlightRef.current = run();
    return refreshInFlightRef.current;
  }, [user?.role]);

  useEffect(() => {
    void refresh({ silent: false });
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const value = useMemo(
    () => ({ users, otpRequests, counts, loading, refreshing, error, refresh }),
    [users, otpRequests, counts, loading, refreshing, error, refresh],
  );

  return <AdminUsersContext.Provider value={value}>{children}</AdminUsersContext.Provider>;
}

export function useAdminUsers() {
  const ctx = useContext(AdminUsersContext);
  if (!ctx) throw new Error('useAdminUsers must be used within AdminUsersProvider');
  return ctx;
}

/** Nav badge only — uses shared context counts when inside AdminUsersProvider */
export function useAdminPendingCount() {
  const ctx = useContext(AdminUsersContext);
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (ctx || user?.role !== 'admin') return;

    const poll = () => {
      authApi.adminUsersSummary()
        .then((c) => setPendingCount(c.pending))
        .catch(() => setPendingCount(0));
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [ctx, user?.role]);

  if (ctx) return ctx.counts.pending;
  return pendingCount;
}
