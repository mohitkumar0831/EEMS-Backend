import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: ['Free', 'Basic', 'Standard', 'Enterprise'],
    },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Pricing
    priceMonthly: { type: Number, required: true, default: 0 },
    priceQuarterly: { type: Number, default: 0 },
    priceYearly: { type: Number, default: 0 },
    currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD'] },

    // Limits
    userLimit: { type: Number, required: true, default: 10 },
    storageGB: { type: Number, required: true, default: 2 },
    branchLimit: { type: Number, default: 1 },

    // Features
    supportLevel: {
      type: String,
      enum: ['Community Forum', 'Email Only', 'Email & Phone', '24/7 Dedicated'],
      default: 'Community Forum',
    },
    customDomain: { type: Boolean, default: false },
    features: {
      type: [String],
      default: [],
    },

    // Plan ordering & status
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }, // Default plan for new tenants (e.g., Free)
  },
  { timestamps: true }
);

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
