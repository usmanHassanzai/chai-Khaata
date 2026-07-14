import { getPlan, isSubscriptionExpired } from './subscriptions.js';
import { readUsers, updateUser } from './store.js';
import { sendSubscriptionExpiryReminder } from './email.js';

export const REMINDER_DAYS_BEFORE = 7;

const DEFAULT_TZ = process.env.REMINDER_TIMEZONE || 'Asia/Karachi';

/** @param {Date} date @param {string} [timeZone] */
export function dateKeyInTimezone(date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Calendar days from today until expiry (in timezone). */
export function daysUntilExpiry(expiresAt, now = new Date(), timeZone = DEFAULT_TZ) {
  const expiryKey = dateKeyInTimezone(new Date(expiresAt), timeZone);
  const todayKey = dateKeyInTimezone(now, timeZone);
  const [ey, em, ed] = expiryKey.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const expiryUtc = Date.UTC(ey, em - 1, ed);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((expiryUtc - todayUtc) / 86_400_000);
}

/** @param {import('./store.js').UserRecord} user @param {string} [todayKey] */
export function shouldSendExpiryReminder(user, todayKey = dateKeyInTimezone()) {
  if (user.role === 'admin') return false;
  if (user.status !== 'approved') return false;
  if (!user.subscriptionExpiresAt || !user.email?.trim()) return false;
  if (isSubscriptionExpired(user)) return false;

  const daysLeft = daysUntilExpiry(user.subscriptionExpiresAt);
  if (daysLeft < 1 || daysLeft > REMINDER_DAYS_BEFORE) return false;
  if (user.lastExpiryReminderDate === todayKey) return false;

  return true;
}

function siteRenewUrl() {
  const base = (
    process.env.PUBLIC_SERVER_URL
    || process.env.SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || 'https://patiwala.pk'
  ).replace(/\/$/, '');
  return `${base}/subscription-renew`;
}

/**
 * Send daily expiry reminders to users within 7 days of subscription end.
 * @returns {Promise<{ sent: number, skipped: number, errors: string[] }>}
 */
export async function runSubscriptionExpiryReminders() {
  const todayKey = dateKeyInTimezone();
  const users = await readUsers();
  const errors = [];
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    if (!shouldSendExpiryReminder(user, todayKey)) {
      skipped += 1;
      continue;
    }

    const daysLeft = daysUntilExpiry(user.subscriptionExpiresAt);
    const plan = getPlan(user.subscriptionPlan ?? '');

    try {
      const result = await sendSubscriptionExpiryReminder(
        user.email,
        user,
        daysLeft,
        plan?.label ?? user.subscriptionPlan ?? 'Subscription',
        siteRenewUrl(),
      );

      if (result.sent) {
        await updateUser(user.id, { lastExpiryReminderDate: todayKey });
        sent += 1;
        console.log(`[Chai Khata] Expiry reminder sent to ${user.email} (${daysLeft} day(s) left)`);
      } else {
        errors.push(`${user.username}: ${result.reason ?? 'email not sent'}`);
        skipped += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user.username}: ${msg}`);
      console.error(`[Chai Khata] Expiry reminder failed for ${user.username}:`, msg);
    }
  }

  return { sent, skipped, errors, todayKey };
}

/** Clear reminder tracking when subscription is extended. */
export function clearExpiryReminderFields() {
  return { lastExpiryReminderDate: undefined };
}
