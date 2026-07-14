/** Notify admin about a new signup (email + console). */
export async function notifyAdminNewSignup(adminEmail, user, registrationPassword, registrationFee, plan) {
  console.log(
    `[Chai Khata] NEW SIGNUP (pending approval)
  Payment ID:     ${user.paymentRefId ?? '—'}
  Username:       ${user.username}
  Email:          ${user.email || '—'}
  Phone:          ${user.phone || '—'}
  Password:       ${registrationPassword}
  Subscription:   ${plan?.label ?? user.subscriptionPlan ?? '—'}
  Payment Fee:    Rs ${registrationFee}
  Fee Date:       ${user.paymentFeeDate || '—'}
  Register Date:  ${user.createdAt}
  Shop:           ${user.shopName || '—'}
  → Approve in Admin → Approvals (admin: ${adminEmail})`,
  );

  try {
    const { sendAdminSignupEmail } = await import('./email.js');
    const result = await sendAdminSignupEmail(adminEmail, user, registrationPassword, registrationFee, plan);
    if (!result.sent) {
      console.warn(`[Chai Khata] Admin signup email NOT sent to ${adminEmail}: ${result.reason ?? 'unknown'}`);
    }
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Notification failed';
    console.error('[Chai Khata] Admin signup notification error:', reason);
    return { sent: false, reason };
  }
}

/** Notify admin when a pending user tries to log in. */
export async function notifyAdminPendingLogin(adminEmail, user) {
  console.log(
    `[Chai Khata] PENDING USER LOGIN
  Payment ID: ${user.paymentRefId ?? '—'}
  User:       ${user.username} (${user.email})
  → Review payment screenshot in Admin → Approvals`,
  );

  const { sendAdminPendingLoginEmail } = await import('./email.js');
  await sendAdminPendingLoginEmail(adminEmail, user);
}
