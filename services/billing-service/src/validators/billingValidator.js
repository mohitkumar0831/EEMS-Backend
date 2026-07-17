import Joi from 'joi';

// Plan validators
export const createPlanSchema = Joi.object({
  name: Joi.string().valid('Free', 'Basic', 'Standard', 'Enterprise').required(),
  displayName: Joi.string().required().trim(),
  description: Joi.string().allow('').default(''),
  priceMonthly: Joi.number().min(0).required(),
  priceQuarterly: Joi.number().min(0).default(0),
  priceYearly: Joi.number().min(0).default(0),
  currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'AUD').default('INR'),
  userLimit: Joi.number().integer().min(1).required(),
  storageGB: Joi.number().min(0).required(),
  branchLimit: Joi.number().integer().min(1).default(1),
  supportLevel: Joi.string().valid('Community Forum', 'Email Only', 'Email & Phone', '24/7 Dedicated').default('Community Forum'),
  customDomain: Joi.boolean().default(false),
  features: Joi.array().items(Joi.string()).default([]),
  sortOrder: Joi.number().integer().default(0),
  isDefault: Joi.boolean().default(false),
});

export const updatePlanSchema = Joi.object({
  displayName: Joi.string().trim(),
  description: Joi.string().allow(''),
  priceMonthly: Joi.number().min(0),
  priceQuarterly: Joi.number().min(0),
  priceYearly: Joi.number().min(0),
  currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'AUD'),
  userLimit: Joi.number().integer().min(1),
  storageGB: Joi.number().min(0),
  branchLimit: Joi.number().integer().min(1),
  supportLevel: Joi.string().valid('Community Forum', 'Email Only', 'Email & Phone', '24/7 Dedicated'),
  customDomain: Joi.boolean(),
  features: Joi.array().items(Joi.string()),
  sortOrder: Joi.number().integer(),
  isDefault: Joi.boolean(),
}).min(1);

// Subscription validators
export const createSubscriptionSchema = Joi.object({
  tenantId: Joi.string().required(),
  tenantSlug: Joi.string().required(),
  companyName: Joi.string().required(),
  planId: Joi.string().required(),
  billingCycle: Joi.string().valid('Monthly', 'Quarterly', 'Yearly').default('Monthly'),
  startDate: Joi.date().default(() => new Date()),
  trialDays: Joi.number().integer().min(0).default(14),
});

export const upgradeSubscriptionSchema = Joi.object({
  planId: Joi.string().required(),
  billingCycle: Joi.string().valid('Monthly', 'Quarterly', 'Yearly'),
});

export const overrideSubscriptionSchema = Joi.object({
  status: Joi.string().valid('Trial', 'Active', 'PastDue', 'Expired', 'Suspended', 'Cancelled'),
  endDate: Joi.date(),
  gracePeriodDays: Joi.number().integer().min(0),
  autoRenew: Joi.boolean(),
}).min(1);

// Payment validators
export const createOrderSchema = Joi.object({
  subscriptionId: Joi.string().required(),
  tenantId: Joi.string().required(),
  tenantSlug: Joi.string().required(),
  targetPlanId: Joi.string().optional(),
});

export const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  subscriptionId: Joi.string().required(),
});
