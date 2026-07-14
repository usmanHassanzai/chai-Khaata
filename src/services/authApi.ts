export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'admin';

export type SubscriptionPlanId = 'monthly' | 'six_month' | 'yearly';

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
}

export interface PaymentSubmission {
  id: string;
  userId: string;
  username: string;
  email: string;
  phone: string;
  paymentDue: number;
  subscriptionPlan?: string;
  kind?: 'payment_due' | 'subscription_renewal';
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
  otpDelivery?: {
    emailConfigured: boolean;
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
import { ApiError, getStoredToken } from './authCommon';
import { getCloudApiUrl } from './cloudConfig';

function apiBase(): string {
  // Local dev: always use Vite proxy (same origin) — avoids broken cloud URLs like patiwala.pk
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
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
  } catch (err) {
    const isLocal = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname);
    throw new ApiError(
      'NETWORK_ERROR',
      isLocal
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
    throw new ApiError(
      (data.error as string) ?? 'REQUEST_FAILED',
      (data.message as string) ?? `Request failed (${res.status})`,
      data.user as AuthUser | undefined,
    );
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
    return request<{ message: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, phone, password, subscriptionPlan, paymentFeeDate, shopName }),
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

  resetPassword(login: string, otp: string, newPassword: string) {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ login, otp, newPassword }),
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

  listUsers() {
    return request<{ users: AuthUser[] }>('/api/admin/users');
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
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      bases.push(origin);
    }
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
