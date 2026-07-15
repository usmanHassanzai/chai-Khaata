import {
  adminUser,
  adminUserListItem,
  adminUserCounts,
  findUsersByIds,
  readUsersForAdmin,
} from './store.js';
import { listActiveOtps } from './otpStore.js';

export const ADMIN_QUERY_TIMEOUT_MS = 8000;

/** @param {URLSearchParams | { get: (key: string) => string | null | undefined }} searchParams */
export async function listAdminUsers(searchParams) {
  const statusParam = String(searchParams.get('status') ?? '').trim();
  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const includeAdmin = searchParams.get('includeAdmin') === '1';
  const excludeAdmin = !includeAdmin;
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 500;
  const full = searchParams.get('full') === '1';

  const users = await readUsersForAdmin({ statuses, excludeAdmin, limit });
  const mapper = full ? adminUser : adminUserListItem;

  return {
    users: users.map(mapper),
    limit,
    truncated: users.length >= limit,
  };
}

export async function getAdminUsersSummary() {
  return adminUserCounts();
}

export async function listAdminOtpRequests() {
  const otps = await listActiveOtps();
  const users = await findUsersByIds(otps.map((o) => o.userId));
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    requests: otps.map((o) => {
      const user = byId.get(o.userId);
      return {
        userId: o.userId,
        username: user?.username ?? '—',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        otp: o.otp,
        channel: o.channel,
        sentTo: o.sentTo,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
      };
    }),
  };
}

export async function getAdminDashboard(searchParams) {
  const usersResult = await listAdminUsers(searchParams);
  let counts;
  try {
    counts = await getAdminUsersSummary();
  } catch (err) {
    console.warn('[Chai Khata] Dashboard counts fallback from user list:', err instanceof Error ? err.message : err);
    counts = countsFromUsers(usersResult.users);
  }
  return { ...usersResult, counts };
}

function countsFromUsers(users) {
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

export function adminHandlerError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/timed out after/i.test(message)) {
    return {
      status: 503,
      body: {
        error: 'TIMEOUT',
        message: 'Database query took too long. Please retry in a moment.',
      },
    };
  }
  if (/SUPABASE|schema|PGRST|column|relation.*does not exist|invalid api key|SERVER_CONFIG/i.test(message)) {
    return {
      status: 503,
      body: {
        error: 'DATABASE_ERROR',
        message: 'Database query failed. Run supabase/migrate-production.sql in Supabase SQL Editor, then redeploy.',
      },
    };
  }
  return {
    status: 500,
    body: {
      error: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Could not complete admin request'
        : message,
    },
  };
}
