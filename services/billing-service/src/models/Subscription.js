import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    tenantSlug: { type: String, required: true, index: true },
    companyName: { type: String, required: true },

    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planName: { type: String, required: true }, // Denormalized for quick reads

    status: {
      type: String,
      enum: ['Trial', 'Active', 'PastDue', 'Expired', 'Suspended', 'Cancelled'],
      default: 'Trial',
      index: true,
    },

    billingCycle: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Yearly'],
      default: 'Monthly',
    },

    // Amount currently being charged per cycle
    currentAmount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'INR' },

    // Dates
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    trialEndDate: { type: Date, default: null },
    lastPaymentDate: { type: Date, default: null },
    nextBillingDate: { type: Date, default: null },

    // Grace period (days after expiry before suspension)
    gracePeriodDays: { type: Number, default: 7 },
    graceEndDate: { type: Date, default: null },

    // Auto-renewal
    autoRenew: { type: Boolean, default: false },
    razorpaySubscriptionId: { type: String, default: null }, // For Razorpay auto-debit

    // Reminders tracking
    remindersSent: {
      sevenDay: { type: Boolean, default: false },
      threeDay: { type: Boolean, default: false },
      oneDay: { type: Boolean, default: false },
      expired: { type: Boolean, default: false },
    },

    // History
    previousPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    upgradedAt: { type: Date, default: null },

    createdBy: { type: String, default: null }, // super_admin userId who created
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for cron queries
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ graceEndDate: 1, status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
