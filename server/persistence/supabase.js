import { getSupabase } from '../supabase.js';

function throwSupabaseError(error) {
  const message = error?.message || error?.details || error?.hint || JSON.stringify(error);
  const err = new Error(message);
  if (error?.code) err.code = error.code;
  throw err;
}

/** @param {Record<string, unknown>} row */
export function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    phone: row.phone ?? '',
    passwordHash: row.password_hash,
    registrationPassword: row.registration_password ?? undefined,
    shopName: row.shop_name ?? '',
    status: row.status,
    role: row.role,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? undefined,
    paymentDue: Math.max(0, Number(row.payment_due) || 0),
    paymentDueNote: row.payment_due_note ?? '',
    lastPaidAt: row.last_paid_at ?? undefined,
    registrationFee: row.registration_fee != null ? Number(row.registration_fee) : undefined,
    paymentFeeDate: row.payment_fee_date ?? undefined,
    subscriptionPlan: row.subscription_plan ?? undefined,
    subscriptionStartsAt: row.subscription_starts_at ?? undefined,
    subscriptionExpiresAt: row.subscription_expires_at ?? undefined,
    signupSnapshot: row.signup_snapshot ?? undefined,
    paymentRefId: row.payment_ref_id ?? undefined,
    trialStartedAt: row.trial_started_at ?? undefined,
    trialEndsAt: row.trial_ends_at ?? undefined,
    lastExpiryReminderDate: row.last_expiry_reminder_date ?? undefined,
    renewalGraceEndsAt: row.renewal_grace_ends_at ?? undefined,
  };
}

/** @param {import('../store.js').UserRecord} user */
export function userToRow(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone ?? '',
    password_hash: user.passwordHash,
    registration_password: user.registrationPassword ?? null,
    shop_name: user.shopName ?? '',
    status: user.status,
    role: user.role,
    created_at: user.createdAt,
    approved_at: user.approvedAt ?? null,
    payment_due: user.paymentDue ?? 0,
    payment_due_note: user.paymentDueNote ?? '',
    last_paid_at: user.lastPaidAt ?? null,
    registration_fee: user.registrationFee ?? null,
    payment_fee_date: user.paymentFeeDate ?? null,
    subscription_plan: user.subscriptionPlan ?? null,
    subscription_starts_at: user.subscriptionStartsAt ?? null,
    subscription_expires_at: user.subscriptionExpiresAt ?? null,
    signup_snapshot: user.signupSnapshot ?? null,
    payment_ref_id: user.paymentRefId ?? null,
    trial_started_at: user.trialStartedAt ?? null,
    trial_ends_at: user.trialEndsAt ?? null,
    last_expiry_reminder_date: user.lastExpiryReminderDate ?? null,
    renewal_grace_ends_at: user.renewalGraceEndsAt ?? null,
  };
}

export async function sbReadUsers() {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []).map(rowToUser);
}

/** Lite columns for admin list — excludes password_hash and signup_snapshot (large jsonb). */
const ADMIN_USER_LIST_COLUMNS = [
  'id', 'username', 'email', 'phone', 'shop_name', 'status', 'role', 'created_at', 'approved_at',
  'payment_due', 'payment_due_note', 'last_paid_at', 'registration_fee', 'payment_fee_date',
  'subscription_plan', 'subscription_starts_at', 'subscription_expires_at',
].join(',');

/** Older DBs may miss optional columns — retry with this set. */
const ADMIN_USER_CORE_COLUMNS = [
  'id', 'username', 'email', 'phone', 'shop_name', 'status', 'role', 'created_at', 'approved_at',
  'payment_due', 'payment_due_note', 'registration_fee', 'payment_fee_date', 'subscription_plan',
].join(',');

const ADMIN_USER_MIN_COLUMNS = 'id,username,email,phone,shop_name,status,role,created_at,approved_at,payment_due';

/** @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query */
async function runAdminListQuery(query) {
  const { data, error } = await query;
  if (error) throwSupabaseError(error);
  return (data ?? []).map(rowToUser);
}

/** @param {{ statuses?: string[], excludeAdmin?: boolean, limit?: number, offset?: number }} [opts] */
export async function sbReadUsersForAdmin(opts = {}) {
  const { statuses, excludeAdmin = true, limit = 500, offset = 0 } = opts;
  const cappedLimit = Math.min(Math.max(1, limit), 1000);
  const safeOffset = Math.max(0, Number(offset) || 0);

  function buildQuery(columns) {
    let query = getSupabase()
      .from('users')
      .select(columns)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + cappedLimit - 1);

    if (excludeAdmin) query = query.neq('role', 'admin');
    if (statuses?.length) query = query.in('status', statuses);
    return query;
  }

  const columnTiers = [ADMIN_USER_LIST_COLUMNS, ADMIN_USER_CORE_COLUMNS, ADMIN_USER_MIN_COLUMNS];
  let lastError = null;

  for (const columns of columnTiers) {
    try {
      return await runAdminListQuery(buildQuery(columns));
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      lastError = err;
      console.warn('[Chai Khata] Admin list retry with fewer columns:', err.message);
    }
  }

  if (lastError) throw lastError;
  return [];
}

/** @param {string[]} ids */
export async function sbFindUsersByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await getSupabase()
    .from('users')
    .select('id, username, email, phone')
    .in('id', ids);

  if (error) throwSupabaseError(error);
  return (data ?? []).map(rowToUser);
}

async function sbCountUsersByStatus(status) {
  const { count, error } = await getSupabase()
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .neq('role', 'admin');

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function sbAdminUserCounts() {
  try {
    const [pending, rejected, approved] = await Promise.all([
      sbCountUsersByStatus('pending'),
      sbCountUsersByStatus('rejected'),
      sbCountUsersByStatus('approved'),
    ]);
    return { pending, rejected, approved, total: pending + rejected + approved };
  } catch (err) {
    // Fallback: derive from lite list if count queries fail (schema/RLS edge cases)
    console.warn('[Chai Khata] Admin counts fallback:', err instanceof Error ? err.message : err);
    const users = await sbReadUsersForAdmin({ excludeAdmin: true, limit: 1000 });
    let pending = 0;
    let rejected = 0;
    let approved = 0;
    for (const user of users) {
      if (user.status === 'pending') pending += 1;
      else if (user.status === 'rejected') rejected += 1;
      else if (user.status === 'approved') approved += 1;
    }
    return { pending, rejected, approved, total: pending + rejected + approved };
  }
}

export async function sbFindUserByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToUser(data) : null;
}

export async function sbFindUserByUsername(username) {
  const normalized = username.trim().toLowerCase();
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('username', normalized)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToUser(data) : null;
}

export async function sbFindUserById(id) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToUser(data) : null;
}

/** Fetch only fields needed to verify and update a password. */
export async function sbGetPasswordCredentials(id) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id, password_hash, role')
    .eq('id', id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) return null;
  return {
    id: data.id,
    passwordHash: data.password_hash,
    role: data.role,
  };
}

/** Update password fields only — avoids loading/updating the full user row. */
export async function sbUpdatePassword(id, passwordHash, registrationPassword, role) {
  const patch = {
    password_hash: passwordHash,
    registration_password: role === 'admin' ? null : registrationPassword,
  };

  const { error } = await getSupabase()
    .from('users')
    .update(patch)
    .eq('id', id);

  if (error) throwSupabaseError(error);
}


export async function sbPaymentRefIdExists(refId) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id')
    .eq('payment_ref_id', refId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return Boolean(data);
}

function isMissingColumnError(error) {
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return /could not find|schema cache|PGRST204|column.*does not exist|unknown column/i.test(text);
}

function coreUserRow(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone ?? '',
    password_hash: user.passwordHash,
    registration_password: user.registrationPassword ?? null,
    shop_name: user.shopName ?? '',
    status: user.status,
    role: user.role,
    created_at: user.createdAt,
    payment_due: user.paymentDue ?? 0,
    payment_due_note: user.paymentDueNote ?? '',
    registration_fee: user.registrationFee ?? null,
    payment_fee_date: user.paymentFeeDate ?? null,
    subscription_plan: user.subscriptionPlan ?? null,
  };
}

export async function sbInsertUser(user) {
  const fullRow = userToRow(user);
  let result = await getSupabase()
    .from('users')
    .insert(fullRow)
    .select('*')
    .single();

  if (result.error && isMissingColumnError(result.error)) {
    console.warn('[Chai Khata] Full user insert failed — retrying with core columns:', result.error.message);
    result = await getSupabase()
      .from('users')
      .insert(coreUserRow(user))
      .select('*')
      .single();
  }

  const { data, error } = result;

  if (error) {
    if (error.code === '23505') {
      const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      if (text.includes('username')) throw new Error('USERNAME_TAKEN');
      if (text.includes('email')) throw new Error('EMAIL_TAKEN');
      throw new Error('USERNAME_TAKEN');
    }
    throwSupabaseError(error);
  }
  return rowToUser(data);
}

export async function sbUpdateUser(id, patch) {
  const existing = await sbFindUserById(id);
  if (!existing) throw new Error('NOT_FOUND');

  const merged = { ...existing, ...patch };
  if (patch.email) merged.email = String(patch.email).trim().toLowerCase();
  if (patch.username) merged.username = String(patch.username).trim().toLowerCase();
  if ('registrationPassword' in patch && patch.registrationPassword === undefined) {
    delete merged.registrationPassword;
  }
  if ('lastExpiryReminderDate' in patch && patch.lastExpiryReminderDate === undefined) {
    delete merged.lastExpiryReminderDate;
  }

  let result = await getSupabase()
    .from('users')
    .update(userToRow(merged))
    .eq('id', id)
    .select('*')
    .single();

  if (result.error && isMissingColumnError(result.error) && merged.renewalGraceEndsAt !== undefined) {
    console.warn('[Chai Khata] renewal_grace_ends_at missing — run supabase/migrate-production.sql');
    const fallback = { ...merged };
    delete fallback.renewalGraceEndsAt;
    result = await getSupabase()
      .from('users')
      .update(userToRow(fallback))
      .eq('id', id)
      .select('*')
      .single();
  }

  const { data, error } = result;

  if (error) {
    if (error.code === '23505') {
      if (error.message?.includes('username')) throw new Error('USERNAME_TAKEN');
      if (error.message?.includes('email')) throw new Error('EMAIL_TAKEN');
    }
    throwSupabaseError(error);
  }
  return rowToUser(data);
}

export async function sbDeleteUser(id) {
  const existing = await sbFindUserById(id);
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.role === 'admin') throw new Error('CANNOT_DELETE_ADMIN');

  const { error } = await getSupabase().from('users').delete().eq('id', id);
  if (error) throwSupabaseError(error);
  return existing;
}

/** @param {Record<string, unknown>} row */
function rowToOtp(row) {
  return {
    userId: row.user_id,
    otp: row.otp,
    channel: row.channel,
    sentTo: row.sent_to,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function sbCreateOtp(record) {
  const { data, error } = await getSupabase()
    .from('otps')
    .upsert({
      user_id: record.userId,
      otp: record.otp,
      channel: record.channel,
      sent_to: record.sentTo,
      expires_at: record.expiresAt,
      created_at: record.createdAt,
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throwSupabaseError(error);
  return rowToOtp(data);
}

export async function sbGetOtp(userId) {
  const { data, error } = await getSupabase()
    .from('otps')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToOtp(data) : null;
}

export async function sbDeleteOtp(userId) {
  await getSupabase().from('otps').delete().eq('user_id', userId);
}

export async function sbListActiveOtps() {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('otps')
    .select('user_id, otp, channel, sent_to, expires_at, created_at')
    .gt('expires_at', now);

  if (error) throwSupabaseError(error);
  return (data ?? []).map(rowToOtp);
}

/** @param {Record<string, unknown>} row */
function rowToSubmission(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    phone: row.phone ?? '',
    paymentDue: Number(row.payment_due) || 0,
    subscriptionPlan: row.subscription_plan ?? undefined,
    kind: row.kind ?? 'payment_due',
    screenshot: row.screenshot,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
    rejectNote: row.reject_note ?? undefined,
  };
}

/** @param {import('../paymentSubmissions.js').PaymentSubmission} s */
function submissionToRow(s) {
  return {
    id: s.id,
    user_id: s.userId,
    username: s.username,
    email: s.email,
    phone: s.phone ?? '',
    payment_due: s.paymentDue ?? 0,
    subscription_plan: s.subscriptionPlan ?? null,
    kind: s.kind ?? 'payment_due',
    screenshot: s.screenshot,
    status: s.status,
    created_at: s.createdAt,
    reviewed_at: s.reviewedAt ?? null,
    reject_note: s.rejectNote ?? null,
  };
}

export async function sbFindPendingSubmission(userId) {
  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToSubmission(data) : null;
}

export async function sbCreateSubmission(record) {
  await getSupabase()
    .from('payment_submissions')
    .delete()
    .eq('user_id', record.userId)
    .eq('status', 'pending');

  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .insert(submissionToRow(record))
    .select('*')
    .single();

  if (error) throwSupabaseError(error);
  return rowToSubmission(data);
}

export async function sbUpdateSubmission(id, patch) {
  const { data: existing, error: findErr } = await getSupabase()
    .from('payment_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (findErr) throwSupabaseError(findErr);
  if (!existing) throw new Error('NOT_FOUND');

  const merged = { ...rowToSubmission(existing), ...patch };
  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .update(submissionToRow(merged))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throwSupabaseError(error);
  return rowToSubmission(data);
}

export async function sbListPendingSubmissions() {
  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throwSupabaseError(error);
  return (data ?? []).map(rowToSubmission);
}

const SUBMISSION_LIST_COLUMNS = [
  'id', 'user_id', 'username', 'email', 'phone', 'payment_due', 'subscription_plan',
  'kind', 'status', 'created_at', 'reviewed_at', 'reject_note',
].join(',');

export async function sbListPendingSubmissionsMeta() {
  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .select(SUBMISSION_LIST_COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throwSupabaseError(error);
  return (data ?? []).map((row) => ({
    ...rowToSubmission({ ...row, screenshot: null }),
    hasScreenshot: true,
  }));
}

export async function sbFindSubmissionById(id) {
  const { data, error } = await getSupabase()
    .from('payment_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? rowToSubmission(data) : null;
}

export async function sbClearSubmissionsForUser(userId) {
  await getSupabase().from('payment_submissions').delete().eq('user_id', userId);
}

export async function sbReadLedger(userId, options = {}) {
  const {
    sbReadLedgerTables,
    sbReadLedgerSnapshotOnly,
    sbMigrateSnapshotToTables,
  } = await import('./ledgerTables.js');

  const tableLedger = await sbReadLedgerTables(userId, options);
  if (tableLedger) return tableLedger;

  // Lite login should not run a heavy migrate; return slim snapshot if present
  const snapshot = await sbReadLedgerSnapshotOnly(userId);
  if (!snapshot) return null;

  // Cursor-only rows use payload: {} — treat as empty so clients upload local data
  const entityCount = (snapshot.dealers?.length || 0)
    + (snapshot.customers?.length || 0)
    + (snapshot.purchases?.length || 0)
    + (snapshot.sales?.length || 0)
    + (snapshot.payments?.length || 0);
  if (entityCount === 0) return null;

  if (options.lite) return slimSnapshotImages(snapshot);

  const migrated = await sbMigrateSnapshotToTables(userId, snapshot);
  return migrated || snapshot;
}

function slimSnapshotImages(snapshot) {
  const stripRow = (row) => {
    if (!row || typeof row !== 'object') return row;
    const next = { ...row };
    delete next.billImage;
    delete next.profilePicture;
    delete next.receiveReceiptImage;
    delete next.paymentReceiptImage;
    delete next.receiptImage;
    delete next.shopLogo;
    return next;
  };
  return {
    ...snapshot,
    dealers: (snapshot.dealers ?? []).map(stripRow),
    customers: (snapshot.customers ?? []).map(stripRow),
    purchases: (snapshot.purchases ?? []).map(stripRow),
    sales: (snapshot.sales ?? []).map(stripRow),
    payments: (snapshot.payments ?? []).map(stripRow),
    settings: (snapshot.settings ?? []).map(stripRow),
  };
}

export async function sbWriteLedger(userId, snapshot) {
  const { sbWriteLedgerTables } = await import('./ledgerTables.js');
  return sbWriteLedgerTables(userId, snapshot);
}

export async function sbDeleteLedger(userId) {
  const { sbDeleteLedgerTables } = await import('./ledgerTables.js');
  await sbDeleteLedgerTables(userId);
  await getSupabase().from('ledger_snapshots').delete().eq('user_id', userId);
}
