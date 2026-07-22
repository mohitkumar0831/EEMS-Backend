import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Payment from '../models/Payment.js';
import {
  sendSubscriptionCreatedEvent,
  sendSubscriptionActivatedEvent,
  sendSubscriptionExpiredEvent,
  sendSubscriptionSuspendedEvent,
  sendNotificationEvent,
} from '../utils/events.js';

/**
 * Calculate end date based on billing cycle
 */
const calculateEndDate = (startDate, billingCycle) => {
  const end = new Date(startDate);
  switch (billingCycle) {
    case 'Monthly':     end.setMonth(end.getMonth() + 1); break;
    case 'Quarterly':   end.setMonth(end.getMonth() + 3); break;
    case 'Half-Yearly': end.setMonth(end.getMonth() + 6); break;
    case 'Yearly':      end.setFullYear(end.getFullYear() + 1); break;
    default:            end.setMonth(end.getMonth() + 1);
  }
  return end;
};

/**
 * Get plan price based on billing cycle
 */
const getPlanPrice = (plan, billingCycle) => {
  switch (billingCycle) {
    case 'Monthly':     return plan.priceMonthly;
    case 'Quarterly':   return plan.priceQuarterly   || Math.round(plan.priceMonthly * 3  * 0.90);
    case 'Half-Yearly': return plan.priceHalfYearly  || Math.round(plan.priceMonthly * 6  * 0.80);
    case 'Yearly':      return plan.priceYearly       || Math.round(plan.priceMonthly * 12 * 0.70);
    default:            return plan.priceMonthly;
  }
};

/**
 * Create a new subscription for a tenant
 */
export const createSubscription = async (payload) => {
  // Check if tenant already has a subscription
  const existing = await Subscription.findOne({ tenantId: payload.tenantId, isDeleted: false });
  if (existing) {
    throw { status: 409, message: 'Tenant already has an active subscription' };
  }

  const plan = await SubscriptionPlan.findById(payload.planId);
  if (!plan) throw { status: 404, message: 'Subscription plan not found' };

  const startDate = payload.startDate || new Date();
  const billingCycle = payload.billingCycle || 'Monthly';
  const price = getPlanPrice(plan, billingCycle);

  const isTrial = plan.name === 'Trial';

  // Trial plan: 30-day period, no charge, Trial status
  // Paid plans: start Active immediately, end date = billing cycle duration
  const trialDays = 30;
  const trialEndDate = new Date(startDate);
  trialEndDate.setDate(trialEndDate.getDate() + trialDays);

  const initialStatus = payload.status || (isTrial ? 'Trial' : 'Active');
  const endDate = isTrial
    ? trialEndDate                              // Trial: ends after 30 days
    : calculateEndDate(startDate, billingCycle); // Paid: ends after billing cycle

  const subscription = await Subscription.create({
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    companyName: payload.companyName,
    planId: plan._id,
    planName: plan.name,
    status: initialStatus,
    billingCycle,
    currentAmount: isTrial ? 0 : price,
    currency: plan.currency,
    startDate,
    endDate,
    trialEndDate: isTrial ? trialEndDate : null,
    nextBillingDate: isTrial ? trialEndDate : endDate,
    gracePeriodDays: 7,
    createdBy: payload.createdBy || null,
  });

  // Emit event for tenant-service to sync
  await sendSubscriptionCreatedEvent({
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    subscriptionId: subscription._id.toString(),
    planName: plan.name,
    status: subscription.status,
    endDate: subscription.endDate,
  });

  return subscription;
};

/**
 * Get subscription for a tenant
 */
export const getSubscriptionByTenantId = async (tenantId) => {
  const subscription = await Subscription.findOne({ tenantId, isDeleted: false }).populate('planId');
  if (!subscription) throw { status: 404, message: 'No subscription found for this tenant' };
  return subscription;
};

/**
 * Activate subscription after payment
 */
export const activateSubscription = async (subscriptionId, paymentDate, targetPlanId = null) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw { status: 404, message: 'Subscription not found' };

  let plan = await SubscriptionPlan.findById(subscription.planId);
  let isUpgrade = false;
  let previousPlanName = null;

  if (targetPlanId && targetPlanId.toString() !== subscription.planId.toString()) {
    const targetPlan = await SubscriptionPlan.findById(targetPlanId);
    if (!targetPlan) throw { status: 404, message: 'Target plan not found' };

    isUpgrade = true;
    previousPlanName = subscription.planName;
    subscription.previousPlanId = subscription.planId;
    subscription.planId = targetPlan._id;
    subscription.planName = targetPlan.name;
    subscription.currentAmount = getPlanPrice(targetPlan, subscription.billingCycle);
    subscription.upgradedAt = new Date();
    plan = targetPlan;
  }

  const billingStart = paymentDate || new Date();
  const billingEnd = calculateEndDate(billingStart, subscription.billingCycle);

  subscription.status = 'Active';
  subscription.lastPaymentDate = billingStart;
  subscription.endDate = billingEnd;
  subscription.nextBillingDate = billingEnd;
  subscription.graceEndDate = null;

  // Reset reminders for next cycle
  subscription.remindersSent = {
    sevenDay: false,
    threeDay: false,
    oneDay: false,
    expired: false,
  };

  await subscription.save();

  // Emit activation event
  await sendSubscriptionActivatedEvent({
    tenantId: subscription.tenantId,
    tenantSlug: subscription.tenantSlug,
    subscriptionId: subscription._id.toString(),
    planName: subscription.planName,
    status: 'Active',
    endDate: subscription.endDate,
    userLimit: plan?.userLimit,
    storageGB: plan?.storageGB,
    branchLimit: plan?.branchLimit,
    billingCycle: subscription.billingCycle,
    isUpgrade,
    previousPlanName,
    companyName: subscription.companyName,
  });

  return subscription;
};

/**
 * Upgrade or downgrade subscription plan
 */
export const changePlan = async (subscriptionId, newPlanId, newBillingCycle) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw { status: 404, message: 'Subscription not found' };

  const newPlan = await SubscriptionPlan.findById(newPlanId);
  if (!newPlan) throw { status: 404, message: 'Target plan not found' };

  const cycle = newBillingCycle || subscription.billingCycle;
  const newPrice = getPlanPrice(newPlan, cycle);

  subscription.previousPlanId = subscription.planId;
  subscription.planId = newPlan._id;
  subscription.planName = newPlan.name;
  subscription.billingCycle = cycle;
  subscription.currentAmount = newPrice;
  subscription.upgradedAt = new Date();

  // If upgrading during active period, keep current end date
  // Payment for upgrade is handled separately
  await subscription.save();

  return {
    subscription,
    previousPlan: subscription.previousPlanId,
    newPlan: newPlan.name,
    amountDue: newPrice,
  };
};

/**
 * SuperAdmin manual override
 */
export const overrideSubscription = async (subscriptionId, overrides) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw { status: 404, message: 'Subscription not found' };

  if (overrides.status) subscription.status = overrides.status;
  if (overrides.endDate) subscription.endDate = new Date(overrides.endDate);
  if (overrides.gracePeriodDays !== undefined) subscription.gracePeriodDays = overrides.gracePeriodDays;
  if (overrides.autoRenew !== undefined) subscription.autoRenew = overrides.autoRenew;

  await subscription.save();

  // Emit appropriate event based on status change
  if (overrides.status === 'Active') {
    await sendSubscriptionActivatedEvent({
      tenantId: subscription.tenantId,
      tenantSlug: subscription.tenantSlug,
      subscriptionId: subscription._id.toString(),
      planName: subscription.planName,
      status: 'Active',
      endDate: subscription.endDate,
    });
  } else if (overrides.status === 'Suspended') {
    await sendSubscriptionSuspendedEvent({
      tenantId: subscription.tenantId,
      tenantSlug: subscription.tenantSlug,
      subscriptionId: subscription._id.toString(),
    });
  }

  return subscription;
};

/**
 * Get all subscriptions (SuperAdmin overview)
 */
export const getAllSubscriptions = async () => {
  return Subscription.find({ isDeleted: false })
    .populate('planId')
    .sort({ createdAt: -1 });
};

/**
 * Get billing stats for SuperAdmin dashboard
 */
export const getBillingStats = async () => {
  const allSubs = await Subscription.find({ isDeleted: false });

  const totalTenants = allSubs.length;
  const activeSubs = allSubs.filter(s => s.status === 'Active').length;
  const trialSubs = allSubs.filter(s => s.status === 'Trial').length;
  const expiredSubs = allSubs.filter(s => ['Expired', 'PastDue'].includes(s.status)).length;
  const suspendedSubs = allSubs.filter(s => s.status === 'Suspended').length;

  // Calculate MRR (Monthly Recurring Revenue) from active subs
  const mrr = allSubs
    .filter(s => s.status === 'Active')
    .reduce((sum, s) => {
      if (s.billingCycle === 'Monthly')     return sum + s.currentAmount;
      if (s.billingCycle === 'Quarterly')   return sum + (s.currentAmount / 3);
      if (s.billingCycle === 'Half-Yearly') return sum + (s.currentAmount / 6);
      if (s.billingCycle === 'Yearly')      return sum + (s.currentAmount / 12);
      return sum;
    }, 0);

  // Plan distribution
  const planDistribution = {};
  allSubs.forEach(s => {
    planDistribution[s.planName] = (planDistribution[s.planName] || 0) + 1;
  });

  // Calculate Total Subscription Revenue
  const allPayments = await Payment.find({ status: 'Captured' });
  const totalRevenue = allPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);

  return {
    totalTenants,
    activeSubs,
    trialSubs,
    expiredSubs,
    suspendedSubs,
    mrr: Math.round(mrr * 100) / 100,
    planDistribution,
    totalRevenue,
  };
};

/**
 * Mark subscription as expired (called by cron)
 */
export const expireSubscription = async (subscriptionId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  subscription.status = 'PastDue';
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + subscription.gracePeriodDays);
  subscription.graceEndDate = graceEnd;

  await subscription.save();

  await sendSubscriptionExpiredEvent({
    tenantId: subscription.tenantId,
    tenantSlug: subscription.tenantSlug,
    subscriptionId: subscription._id.toString(),
    graceEndDate: graceEnd,
  });

  // Send notification to company admin
  await sendNotificationEvent('notification.subscription_expired', {
    tenantId: subscription.tenantId,
    tenantSlug: subscription.tenantSlug,
    companyName: subscription.companyName,
    planName: subscription.planName,
    graceEndDate: graceEnd,
  });
};

/**
 * Suspend subscription after grace period (called by cron)
 */
export const suspendSubscription = async (subscriptionId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  subscription.status = 'Suspended';
  await subscription.save();

  await sendSubscriptionSuspendedEvent({
    tenantId: subscription.tenantId,
    tenantSlug: subscription.tenantSlug,
    subscriptionId: subscription._id.toString(),
  });

  await sendNotificationEvent('notification.subscription_suspended', {
    tenantId: subscription.tenantId,
    tenantSlug: subscription.tenantSlug,
    companyName: subscription.companyName,
    planName: subscription.planName,
  });
};
