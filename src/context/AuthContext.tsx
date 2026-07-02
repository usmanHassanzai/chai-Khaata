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
import {
  ApiError,
  authApi,
  getStoredToken,
  setStoredToken,
  type AuthUser,
  type SubscriptionPlanId,
} from '../services/authApi';

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
  ) => Promise<string>;
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
    await initUserDatabase(userId);
    setDbReady(true);
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
      try {
        await prepareDatabase(profile.id);
      } catch (dbErr) {
        console.warn('[Chai Khata] Database init:', dbErr);
        setDbReady(false);
      }
      setUser(profile);
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

  const login = useCallback(async (emailOrLogin: string, password: string) => {
    try {
      const { token, user: loggedIn } = await authApi.login(emailOrLogin, password);
      setStoredToken(token);
      await prepareDatabase(loggedIn.id);
      setUser(loggedIn);
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
    const { message } = await authApi.register(username, email, phone, password, subscriptionPlan, paymentFeeDate, shopName);
    return message;
  }, []);

  const logout = useCallback(() => {
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
