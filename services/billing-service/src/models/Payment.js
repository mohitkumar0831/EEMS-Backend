import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    tenantSlug: { type: String, required: true },

    // Amount
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    // Payment gateway fields
    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    // Payment status
    status: {
      type: String,
      enum: ['Created', 'Pending', 'Captured', 'Failed', 'Refunded'],
      default: 'Created',
      index: true,
    },

    // Payment method details
    method: { type: String, default: null }, // upi, card, netbanking, wallet
    description: { type: String, default: 'Subscription payment' },

    // Billing period this payment covers
    billingPeriodStart: { type: Date, default: null },
    billingPeriodEnd: { type: Date, default: null },

    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // Invoice reference
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
