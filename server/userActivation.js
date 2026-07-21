import { clearExpiryReminderFields } from './subscriptionReminders.js';
import { computeExpiryFrom, getPlan, isValidPlanId } from './subscriptions.js';

/** Approve account + start subscription (signup or manual approval). */
export function buildUserApprovalPatch(user, planId) {
  const now = new Date().toISOString();
  const patch = {};
  const effectivePlan = planId && isValidPlanId(planId) ? planId : user.subscriptionPlan;

  if (user.status !== 'approved') {
    patch.status = 'approved';
    patch.approvedAt = now;
  }

  if (effectivePlan && isValidPlanId(effectivePlan)) {
    patch.subscriptionStartsAt = now;
    patch.subscriptionExpiresAt = computeExpiryFrom(now, effectivePlan);
    patch.registrationFee = getPlan(effectivePlan).price;
    Object.assign(patch, clearExpiryReminderFields());
  }

  return patch;
}

export function approvalSuccessMessage(user, planId) {
  const plan = planId && isValidPlanId(planId) ? getPlan(planId) : null;
  if (plan) {
    const expiry = computeExpiryFrom(new Date().toISOString(), planId);
    return `${user.username} approved with ${plan.label} subscription until ${new Date(expiry).toLocaleDateString()}.`;
  }
  return `${user.username} approved — they can now log in.`;
}
