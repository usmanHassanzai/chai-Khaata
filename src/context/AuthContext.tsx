import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initUserDatabase } from '../db/database';
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

  const prepareDatabase = useCallback(async (userId: string) => {
    setDbReady(false);
    try {
      let result = await initUserDatabase(userId);
      if (!result.syncOk) {
        await new Promise((r) => setTimeout(r, 900));
        result = await initUserDatabase(userId);
      }
      if (!result.syncOk && result.syncError) {
        console.warn('[Chai Khata] Cloud sync:', result.syncError);
      }
      setDbReady(true);
    } catch (dbErr) {
      console.warn('[Chai Khata] Database init:', dbErr);
      setDbReady(false);
      throw dbErr;
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
        // Network/server error — keep token so user can retry without re-login
        console.warn('[Chai Khata] Session refresh failed:', err);
      }
    }
  }, [prepareDatabase]);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    const onSessionInvalid = () => {
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
