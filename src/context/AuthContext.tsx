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

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const { user: profile } = await authApi.me();
      await initUserDatabase(profile.id);
      setUser(profile);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'PENDING_APPROVAL' || err.code === 'REJECTED' || err.code === 'PAYMENT_DUE' || err.code === 'SUBSCRIPTION_EXPIRED')) {
        setUser(err.user ?? null);
      } else if (err instanceof ApiError && err.code === 'NOT_FOUND') {
        setStoredToken(null);
        setUser(null);
      } else {
        setStoredToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (emailOrLogin: string, password: string) => {
    try {
      const { token, user: loggedIn } = await authApi.login(emailOrLogin, password);
      setStoredToken(token);
      await initUserDatabase(loggedIn.id);
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
  }, []);

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
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
