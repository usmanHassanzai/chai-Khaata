export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'admin';

export type SubscriptionPlanId = 'monthly' | 'yearly' | 'six_month';

export interface PaymentAccount {
  id: string;
  label: string;
  number: string;
  accountName: string;
}

export interface PaymentConfig {
  accounts: PaymentAccount[];
  whatsapp: string;
  whatsappDisplay: string;
  whatsappLink: string;
  demoDaysMarketing: number;
  pendingTrialHours: number;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  label: string;
  months: number;
  price: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  phone?: string;
  shopName: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  approvedAt?: string;
  registrationPassword?: string;
  registrationFee?: number;
  paymentFeeDate?: string;
  subscriptionPlan?: SubscriptionPlanId | '';
  subscriptionPlanLabel?: string;
  subscriptionStartsAt?: string;
  subscriptionExpiresAt?: string;
  subscriptionExpired?: boolean;
  subscriptionActive?: boolean;
  subscriptionPrice?: number;
  paymentDue?: number;
  paymentDueNote?: string;
  paymentBlocked?: boolean;
  accessBlocked?: boolean;
  lastPaidAt?: string;
  paymentRefId?: string;
  trialActive?: boolean;
  trialEndsAt?: string;
  trialStartedAt?: string;
}

export interface PaymentSubmission {
  id: string;
  userId: string;
  username: string;
  email: string;
  phone: string;
  paymentDue: number;
  subscriptionPlan?: string;
  kind?: 'payment_due' | 'subscription_renewal' | 'signup_payment';
  paymentRefId?: string;
  screenshot: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  rejectNote?: string;
}

export interface OtpRequest {
  userId: string;
  username: string;
  email: string;
  phone: string;
  otp: string;
  channel: 'email' | 'phone';
  sentTo: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthConfig {
  adminEmail: string;
  requiresApproval: boolean;
  subscriptionPlans: SubscriptionPlan[];
  payment?: PaymentConfig;
  otpDelivery?: {
    emailConfigured: boolean;
    adminNotificationsConfigured?: boolean;
    smsConfigured: boolean;
    twilio?: {
      configured: boolean;
      from: string | null;
      accountSid?: string;
    };
  };
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export { ApiError, getStoredToken, setStoredToken } from './authCommon';
import { ApiError, getStoredToken, notifyAuthSessionInvalid } from './authCommon';
import { getCloudApiUrl } from './cloudConfig';
import { isLocalDevHost } from '../utils/authErrors';

/** Auth API base — in dev always same-origin (never a broken remote URL from Settings). */
function apiBase(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }

  const cloud = getCloudApiUrl();
  if (cloud) return cloud;
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      isLocalDevHost()
        ? 'Cannot reach server. Run: npm run dev'
        : 'Cannot reach server. Check internet or Cloud Sync URL in Settings.',
    );
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const isHtml = text.trimStart().startsWith('<!');
      throw new ApiError(
        'REQUEST_FAILED',
        isHtml
          ? `API not found (${res.status}). Redeploy the app or run npm run dev locally.`
          : res.ok
            ? 'Invalid server response'
            : `Server error (${res.status}). Is auth server running?`,
      );
    }
  }

  if (!res.ok) {
    const code = (data.error as string) ?? 'REQUEST_FAILED';
    let message = (data.message as string) ?? `Request failed (${res.status})`;
    if (/fetch failed|typeerror/i.test(message)) {
      message = isLocalDevHost()
        ? 'Cannot reach auth server. Run: npm run dev'
        : 'Server connection failed. Check internet or Cloud Sync URL in Settings.';
    }
    if (res.status === 401 && (code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN')) {
      notifyAuthSessionInvalid();
    }
    throw new ApiError(code, message, data.user as AuthUser | undefined);
  }

  return data as T;
}

export const remoteAuthApi = {
  config() {
    return request<AuthConfig>('/api/auth/config');
  },

  login(emailOrLogin: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: emailOrLogin, password }),
    });
  },

  register(
    username: string,
    email: string,
    phone: string,
    password: string,
    subscriptionPlan: SubscriptionPlanId,
    paymentFeeDate: string,
    shopName?: string,
  ) {
    return request<{
      message: string;
      user: AuthUser;
      paymentRefId: string;
      payment: PaymentConfig;
      adminNotified?: boolean;
      adminNotifyError?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, phone, password, subscriptionPlan, paymentFeeDate, shopName }),
    });
  },

  submitSignupPayment(login: string, password: string, screenshot: string) {
    return request<{ message: string; paymentRefId: string }>('/api/auth/submit-signup-payment', {
      method: 'POST',
      body: JSON.stringify({ login, password, screenshot }),
    });
  },

  subscriptionPlans() {
    return request<{ plans: SubscriptionPlan[] }>('/api/auth/subscription-plans');
  },

  forgotPassword(login: string, channel: 'email' | 'phone') {
    return request<{
      message: string;
      otp?: string;
      maskedTarget: string;
      channel: string;
      expiresAt?: string;
      delivery?: { sent: boolean; reason?: string; via?: string };
    }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ login, channel }),
    });
  },

  recoverPasswordByEmail(email: string) {
    return request<{ message: string; sent?: boolean; maskedEmail?: string }>(
      '/api/auth/recover-password-by-email',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
  },

  resetPassword(login: string, otp: string, newPassword: string) {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ login, otp, newPassword }),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  submitPaymentProof(login: string, password: string, screenshot: string, subscriptionPlan?: SubscriptionPlanId) {
    return request<{ message: string }>('/api/auth/submit-payment-proof', {
      method: 'POST',
      body: JSON.stringify({ login, password, screenshot, subscriptionPlan }),
    });
  },

  checkPaymentSubmission(login: string, password: string) {
    return request<{
      paymentDue: number;
      paymentBlocked: boolean;
      subscriptionExpired: boolean;
      accessBlocked: boolean;
      subscriptionExpiresAt?: string;
      subscriptionPlan?: string;
      pendingSubmission: boolean;
      pendingSubmittedAt?: string;
    }>('/api/auth/check-payment-submission', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
  },

  me() {
    return request<{ user: AuthUser }>('/api/auth/me');
  },

  listUsers(opts?: { status?: string; includeAdmin?: boolean; limit?: number }) {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.includeAdmin) params.set('includeAdmin', '1');
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<{ users: AuthUser[]; limit?: number; truncated?: boolean }>(
      `/api/admin/users${qs ? `?${qs}` : ''}`,
    );
  },

  adminUsersSummary() {
    return request<{ pending: number; rejected: number; approved: number; total: number }>(
      '/api/admin/users/summary',
    );
  },

  listOtpRequests() {
    return request<{ requests: OtpRequest[] }>('/api/admin/otp-requests');
  },

  listPaymentSubmissions() {
    return request<{ submissions: PaymentSubmission[] }>('/api/admin/payment-submissions');
  },

  approvePaymentSubmission(id: string) {
    return request<{ message: string }>(`/api/admin/payment-submissions/${id}/approve`, {
      method: 'PATCH',
    });
  },

  rejectPaymentSubmission(id: string, note?: string) {
    return request<{ message: string }>(`/api/admin/payment-submissions/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  },

  approveUser(id: string) {
    return request<{ user: AuthUser; message: string }>(`/api/admin/users/${id}/approve`, {
      method: 'PATCH',
    });
  },

  rejectUser(id: string) {
    return request<{ user: AuthUser; message: string }>(`/api/admin/users/${id}/reject`, {
      method: 'PATCH',
    });
  },

  deleteUser(id: string) {
    return request<{ message: string; deletedId: string; deletedUsername: string }>(
      `/api/admin/users/${encodeURIComponent(id)}/delete`,
      { method: 'POST' },
    );
  },

  setPaymentDue(id: string, amount: number, note?: string) {
    return request<{ user: AuthUser; message: string }>(`/api/admin/users/${id}/payment-due`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, note }),
    });
  },

  markPaid(id: string) {
    return request<{ user: AuthUser; message: string }>(`/api/admin/users/${id}/mark-paid`, {
      method: 'PATCH',
    });
  },

  sendOtpToUser(id: string, channel: 'email' | 'phone') {
    return request<{ message: string; otp: string; sentTo: string }>(`/api/admin/users/${id}/send-otp`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  },

  sendPasswordToUser(id: string) {
    return request<{ message: string; sent?: boolean }>(`/api/admin/users/${id}/send-password`, {
      method: 'POST',
    });
  },
};

import { Capacitor } from '@capacitor/core';
import { localAuthApi, localHealth } from './localAuth';

export function isNativeAuthMode() {
  return Capacitor.isNativePlatform() && !getCloudApiUrl();
}

export function getApiBase(): string {
  if (isNativeAuthMode()) return '';
  return apiBase();
}

export async function authHealth(): Promise<boolean> {
  if (isNativeAuthMode()) {
    try {
      const r = await localHealth();
      return Boolean(r.ok);
    } catch {
      return false;
    }
  }

  const bases: string[] = [];
  if (typeof window !== 'undefined') {
    bases.push(window.location.origin);
  }
  const primary = getApiBase();
  if (primary && !bases.includes(primary)) bases.push(primary);

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return true;
    } catch {
      /* try next base */
    }
  }
  return false;
}

export const authApi = new Proxy({} as typeof remoteAuthApi, {
  get(_target, prop: keyof typeof remoteAuthApi) {
    const impl = isNativeAuthMode() ? localAuthApi : remoteAuthApi;
    const value = impl[prop];
    return typeof value === 'function' ? value.bind(impl) : value;
  },
});
