/** Notify admin about a new signup (console log). */
export function notifyAdminNewSignup(adminEmail, user, registrationPassword, registrationFee, plan) {
  console.log(
    `[Chai Khata] NEW SIGNUP (pending approval)
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
}
