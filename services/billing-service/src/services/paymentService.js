import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
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
 * Create a Razorpay order for subscription payment
 */
export const createOrder = async (payload) => {
  const { subscriptionId, tenantId, tenantSlug } = payload;

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw { status: 404, message: 'Subscription not found' };
  if (subscription.tenantId !== tenantId) throw { status: 403, message: 'Subscription does not belong to this tenant' };

  const amount = subscription.currentAmount;
  if (amount <= 0) throw { status: 400, message: 'No payment required for free plans' };

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
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
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
    description: `${subscription.planName} plan - ${subscription.billingCycle} subscription`,
    billingPeriodStart,
    billingPeriodEnd,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    paymentId: payment._id,
    planName: subscription.planName,
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
  const subscription = await activateSubscription(subscriptionId, new Date());

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
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100);
};

/**
 * Get monthly payment volume for the specified year
 */
export const getMonthlyVolume = async (year) => {
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const result = await Payment.aggregate([
    {
      $match: {
        status: 'Captured',
        paidAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $month: "$paidAt" },
        totalSpend: { $sum: "$totalAmount" }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  return result;
};
