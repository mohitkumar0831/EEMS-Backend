import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { activateSubscription } from './subscriptionService.js';
import { generateInvoice } from './invoiceService.js';
import { sendPaymentSuccessEvent, sendNotificationEvent } from '../utils/events.js';

/**
 * Get Razorpay instance
 */
const getRazorpayInstance = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw { status: 500, message: 'Razorpay credentials not configured' };
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
};

/**
 * Get plan price based on billing cycle
 */
const getPlanPrice = (plan, billingCycle) => {
  switch (billingCycle) {
    case 'Monthly': return plan.priceMonthly;
    case 'Quarterly': return plan.priceQuarterly || plan.priceMonthly * 3;
    case 'Yearly': return plan.priceYearly || plan.priceMonthly * 12;
    default: return plan.priceMonthly;
  }
};

/**
 * Create a Razorpay order for subscription payment
 */
export const createOrder = async (payload) => {
  const { subscriptionId, tenantId, tenantSlug, targetPlanId } = payload;

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw { status: 404, message: 'Subscription not found' };
  if (subscription.tenantId !== tenantId) throw { status: 403, message: 'Subscription does not belong to this tenant' };

  let amount = subscription.currentAmount;
  let description = `${subscription.planName} plan - ${subscription.billingCycle} subscription`;
  let planName = subscription.planName;

  if (targetPlanId && targetPlanId !== subscription.planId.toString()) {
    const targetPlan = await SubscriptionPlan.findById(targetPlanId);
    if (!targetPlan) throw { status: 404, message: 'Target plan not found' };

    const currentPrice = ['Active', 'Trial'].includes(subscription.status) ? subscription.currentAmount : 0;
    const targetPrice = getPlanPrice(targetPlan, subscription.billingCycle);
    amount = Math.max(0, targetPrice - currentPrice);
    planName = targetPlan.name;
    description = `Upgrade from ${subscription.planName} to ${targetPlan.name} plan - ${subscription.billingCycle} subscription`;
  }

  if (amount <= 0) throw { status: 400, message: 'No payment required for this transaction' };

  // Calculate GST
  const gstPercent = 18;
  const gstAmount = Math.round(amount * gstPercent) / 100;
  const totalAmount = amount + gstAmount;

  // Create Razorpay order
  const rzp = getRazorpayInstance();
  const order = await rzp.orders.create({
    amount: Math.round(totalAmount * 100), // amount in paise
    currency: subscription.currency || 'INR',
    receipt: `sub_${subscriptionId.toString().substring(18)}_${Date.now()}`,
    notes: {
      subscriptionId: subscriptionId,
      tenantId: tenantId,
      tenantSlug: tenantSlug,
      planName: planName,
      billingCycle: subscription.billingCycle,
      targetPlanId: targetPlanId || '',
    },
  });

  // Calculate billing period
  const billingPeriodStart = new Date();
  const billingPeriodEnd = new Date(billingPeriodStart);
  switch (subscription.billingCycle) {
    case 'Monthly': billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1); break;
    case 'Quarterly': billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 3); break;
    case 'Yearly': billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1); break;
  }

  // Create payment record
  const payment = await Payment.create({
    subscriptionId: subscription._id,
    tenantId,
    tenantSlug,
    amount,
    gstPercent,
    gstAmount,
    totalAmount,
    currency: subscription.currency || 'INR',
    razorpayOrderId: order.id,
    status: 'Created',
    description,
    billingPeriodStart,
    billingPeriodEnd,
    targetPlanId: targetPlanId || null,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    paymentId: payment._id,
    planName: planName,
    billingCycle: subscription.billingCycle,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  };
};

/**
 * Verify Razorpay payment and activate subscription
 */
export const verifyPayment = async (payload) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = payload;

  // Verify signature
  const { RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_SECRET) throw { status: 500, message: 'Razorpay secret not configured' };

  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    // Update payment as failed
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { status: 'Failed', failedAt: new Date() }
    );
    throw { status: 400, message: 'Payment verification failed: invalid signature' };
  }

  // Update payment record
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'Captured',
      paidAt: new Date(),
    },
    { new: true }
  );

  if (!payment) throw { status: 404, message: 'Payment record not found' };

  // Activate the subscription
  const subscription = await activateSubscription(subscriptionId, new Date(), payment.targetPlanId);

  // Generate invoice
  const invoice = await generateInvoice(payment, subscription);

  // Update payment with invoice reference
  payment.invoiceId = invoice._id;
  await payment.save();

  // Emit success events
  await sendPaymentSuccessEvent({
    tenantId: payment.tenantId,
    tenantSlug: payment.tenantSlug,
    subscriptionId: subscriptionId,
    paymentId: payment._id.toString(),
    amount: payment.totalAmount,
    planName: subscription.planName,
  });

  // Send payment confirmation notification
  await sendNotificationEvent('notification.payment_success', {
    tenantId: payment.tenantId,
    tenantSlug: payment.tenantSlug,
    companyName: subscription.companyName,
    planName: subscription.planName,
    amount: payment.totalAmount,
    invoiceNumber: invoice.invoiceNumber,
    nextBillingDate: subscription.nextBillingDate,
  });

  return {
    payment,
    subscription,
    invoice,
  };
};

/**
 * Get payment history for a tenant
 */
export const getPaymentHistory = async (tenantId) => {
  return Payment.find({ tenantId })
    .populate('invoiceId')
    .sort({ createdAt: -1 });
};

/**
 * Get all payments (SuperAdmin)
 */
export const getAllPayments = async (filters = {}) => {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.tenantId) query.tenantId = filters.tenantId;

  return Payment.find(query)
    .populate('subscriptionId')
    .populate('invoiceId')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100);
};

/**
 * Get monthly payment volume for the specified year
 */
export const getMonthlyVolume = async (year, month = null) => {
  let startDate, endDate, groupBy;

  if (month) {
    startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    groupBy = { $dayOfMonth: "$paidAt" };
  } else {
    startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    groupBy = { $month: "$paidAt" };
  }

  const result = await Payment.aggregate([
    {
      $match: {
        status: 'Captured',
        paidAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: groupBy,
        totalSpend: { $sum: "$totalAmount" }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  return result;
};
