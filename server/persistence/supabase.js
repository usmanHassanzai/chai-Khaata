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

export async function sbInsertUser(user) {
  const { data, error } = await getSupabase()
    .from('users')
    .insert(userToRow(user))
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      if (error.message?.includes('username')) throw new Error('USERNAME_TAKEN');
      if (error.message?.includes('email')) throw new Error('EMAIL_TAKEN');
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

  const { data, error } = await getSupabase()
    .from('users')
    .update(userToRow(merged))
    .eq('id', id)
    .select('*')
    .single();

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
  await getSupabase().from('otps').delete().lt('expires_at', now);

  const { data, error } = await getSupabase()
    .from('otps')
    .select('*')
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

export async function sbClearSubmissionsForUser(userId) {
  await getSupabase().from('payment_submissions').delete().eq('user_id', userId);
}

export async function sbReadLedger(userId) {
  const { data, error } = await getSupabase()
    .from('ledger_snapshots')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) return null;

  const payload = data.payload ?? {};
  return {
    ...payload,
    userId: data.user_id,
    updatedAt: data.updated_at,
  };
}

export async function sbWriteLedger(userId, snapshot) {
  const record = {
    ...snapshot,
    userId,
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };

  const { dealers, customers, purchases, sales, payments, settings, updatedAt } = record;
  const payload = { dealers, customers, purchases, sales, payments, settings, updatedAt };

  const { error } = await getSupabase()
    .from('ledger_snapshots')
    .upsert({
      user_id: userId,
      updated_at: updatedAt,
      payload,
    }, { onConflict: 'user_id' });

  if (error) throwSupabaseError(error);
  return record;
}

export async function sbDeleteLedger(userId) {
  await getSupabase().from('ledger_snapshots').delete().eq('user_id', userId);
}
