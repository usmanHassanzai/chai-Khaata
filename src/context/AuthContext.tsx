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
import { openUserDatabaseFast, syncUserDatabaseFromCloud } from '../db/database';
import { stopLedgerSyncLoop } from '../services/ledgerSync';
import {
  ApiError,
  authApi,
  getStoredToken,
  setStoredToken,
  type AuthUser,
  type SubscriptionPlanId,
} from '../services/authApi';
import { AUTH_SESSION_INVALID_EVENT } from '../services/authCommon';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  dbReady: boolean;
  login: (emailOrLogin: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    phone: string,
    password: string,
    subscriptionPlan: SubscriptionPlanId,
    paymentFeeDate: string,
    shopName?: string,
  ) => Promise<{ message: string; paymentRefId: string; user: AuthUser; adminNotified?: boolean; adminNotifyError?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const prepareSeq = useRef(0);

  const prepareDatabase = useCallback(async (userId: string) => {
    const seq = ++prepareSeq.current;
    setDbReady(false);
    try {
      // 1) Open local DB instantly so the app is usable
      await openUserDatabaseFast(userId);
      if (seq !== prepareSeq.current) return;
      setDbReady(true);

      // 2) Pull Supabase ledger in background — live queries refresh when done
      void syncUserDatabaseFromCloud(userId).then((result) => {
        if (seq !== prepareSeq.current) return;
        if (!result.syncOk && result.syncError) {
          console.warn('[Chai Khata] Cloud sync:', result.syncError);
        }
      });
    } catch (dbErr) {
      if (seq !== prepareSeq.current) return;
      console.warn('[Chai Khata] Database init:', dbErr);
      // Still unlock UI on laptop — empty local DB is better than infinite spinner
      setDbReady(true);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setDbReady(false);
      return;
    }

    try {
      const { user: profile } = await authApi.me();
      setUser(profile);
      void prepareDatabase(profile.id).catch((dbErr) => {
        console.warn('[Chai Khata] Database init:', dbErr);
        setDbReady(false);
      });
    } catch (err) {
      setDbReady(false);
      if (err instanceof ApiError && (err.code === 'PENDING_APPROVAL' || err.code === 'REJECTED' || err.code === 'PAYMENT_DUE' || err.code === 'SUBSCRIPTION_EXPIRED')) {
        setUser(err.user ?? null);
      } else if (err instanceof ApiError && err.code === 'NOT_FOUND') {
        setStoredToken(null);
        setUser(null);
      } else if (err instanceof ApiError && (err.code === 'UNAUTHORIZED' || err.code === 'INVALID_TOKEN')) {
        setStoredToken(null);
        setUser(null);
      } else {
        console.warn('[Chai Khata] Session refresh failed:', err);
      }
    }
  }, [prepareDatabase]);

  useEffect(() => {
    let cancelled = false;
    refreshUser().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshUser]);

  useEffect(() => {
    const onSessionInvalid = () => {
      prepareSeq.current += 1;
      stopLedgerSyncLoop();
      setUser(null);
      setDbReady(false);
    };
    window.addEventListener(AUTH_SESSION_INVALID_EVENT, onSessionInvalid);
    return () => window.removeEventListener(AUTH_SESSION_INVALID_EVENT, onSessionInvalid);
  }, []);

  const login = useCallback(async (emailOrLogin: string, password: string) => {
    try {
      const { token, user: loggedIn } = await authApi.login(emailOrLogin, password);
      setStoredToken(token);
      setUser(loggedIn);
      await prepareDatabase(loggedIn.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENT_DUE' && err.user) {
        setUser(err.user);
      }
      if (err instanceof ApiError && err.code === 'SUBSCRIPTION_EXPIRED' && err.user) {
        setUser(err.user);
      }
      throw err;
    }
  }, [prepareDatabase]);

  const register = useCallback(async (
    username: string,
    email: string,
    phone: string,
    password: string,
    subscriptionPlan: SubscriptionPlanId,
    paymentFeeDate: string,
    shopName?: string,
  ) => {
    const result = await authApi.register(username, email, phone, password, subscriptionPlan, paymentFeeDate, shopName);
    return {
      message: result.message,
      paymentRefId: result.paymentRefId,
      user: result.user,
      adminNotified: result.adminNotified,
      adminNotifyError: result.adminNotifyError,
    };
  }, []);

  const logout = useCallback(() => {
    prepareSeq.current += 1;
    stopLedgerSyncLoop();
    setStoredToken(null);
    setUser(null);
    setDbReady(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, dbReady, login, register, logout, refreshUser }),
    [user, loading, dbReady, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
