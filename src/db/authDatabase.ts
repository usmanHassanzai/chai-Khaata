import Dexie, { type Table } from 'dexie';

export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'admin';

export interface SignupSnapshot {
  username: string;
  email: string;
  phone: string;
  password: string;
  shopName: string;
  subscriptionPlan: string;
  subscriptionPlanLabel?: string;
  paymentFeeDate: string;
  registrationFee: number;
  registeredAt: string;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  phone?: string;
  passwordHash: string;
  registrationPassword?: string;
  shopName?: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  approvedAt?: string;
  paymentDue?: number;
  paymentDueNote?: string;
  lastPaidAt?: string;
  registrationFee?: number;
  paymentFeeDate?: string;
  subscriptionPlan?: string;
  subscriptionStartsAt?: string;
  subscriptionExpiresAt?: string;
  signupSnapshot?: SignupSnapshot;
}

export interface OtpRecord {
  userId: string;
  otp: string;
  channel: 'email' | 'phone';
  sentTo: string;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentSubmissionRecord {
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

class AuthDatabase extends Dexie {
  users!: Table<UserRecord, string>;
  otps!: Table<OtpRecord, string>;
  submissions!: Table<PaymentSubmissionRecord, string>;

  constructor() {
    super('ChaiKhataAuthDB');
    this.version(1).stores({
      users: 'id, username, email, status, role, createdAt',
      otps: 'userId, expiresAt',
      submissions: 'id, userId, status, createdAt',
    });
  }
}

export const authDb = new AuthDatabase();

let initPromise: Promise<void> | null = null;

export function initAuthDatabase() {
  if (!initPromise) {
    initPromise = authDb.open().then(() => undefined);
  }
  return initPromise;
}
