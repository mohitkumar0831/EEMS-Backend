import SubscriptionPlan from '../models/SubscriptionPlan.js';

/**
 * Create a new subscription plan
 */
export const createPlan = async (payload) => {
  const existing = await SubscriptionPlan.findOne({ name: payload.name });
  if (existing) {
    throw { status: 409, message: `Plan '${payload.name}' already exists` };
  }

  // If this plan is set as default, unset any existing default
  if (payload.isDefault) {
    await SubscriptionPlan.updateMany({}, { isDefault: false });
  }

  const plan = await SubscriptionPlan.create(payload);
  return plan;
};

/**
 * Get all active plans
 */
export const getAllPlans = async (includeInactive = false) => {
  const filter = includeInactive ? {} : { isActive: true };
  return SubscriptionPlan.find(filter).sort({ sortOrder: 1 });
};

/**
 * Get a single plan by ID
 */
export const getPlanById = async (planId) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw { status: 404, message: 'Plan not found' };
  return plan;
};

/**
 * Get a plan by name
 */
export const getPlanByName = async (name) => {
  const plan = await SubscriptionPlan.findOne({ name, isActive: true });
  if (!plan) throw { status: 404, message: `Plan '${name}' not found` };
  return plan;
};

/**
 * Update a plan
 */
export const updatePlan = async (planId, updates) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw { status: 404, message: 'Plan not found' };

  // If setting as default, unset others
  if (updates.isDefault) {
    await SubscriptionPlan.updateMany({ _id: { $ne: planId } }, { isDefault: false });
  }

  Object.assign(plan, updates);
  await plan.save();
  return plan;
};

/**
 * Deactivate a plan (soft delete)
 */
export const deactivatePlan = async (planId) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw { status: 404, message: 'Plan not found' };
  
  plan.isActive = false;
  await plan.save();
  return plan;
};

/**
 * Seed default plans if none exist
 */
export const seedDefaultPlans = async () => {
  const defaults = [
    {
      name: 'Trial',
      displayName: 'Trial',
      description: 'Get started with 1 month trial features',
      priceMonthly: 0, priceQuarterly: 0, priceYearly: 0,
      userLimit: 20, storageGB: 5, branchLimit: 1,
      supportLevel: 'Community Forum',
      customDomain: false,
      features: ['Basic expense tracking', 'Community forum support', '1 Month Free Trial (20 Users, 5GB)'],
      sortOrder: 0, isDefault: true,
    },
    {
      name: 'Basic',
      displayName: 'Basic',
      description: 'For small teams getting started',
      priceMonthly: 150, priceQuarterly: 400, priceYearly: 1500,
      userLimit: 100, storageGB: 20, branchLimit: 3,
      supportLevel: 'Email Only',
      customDomain: false,
      features: ['Full expense tracking', 'Basic reports', 'Email support', 'Approval workflows'],
      sortOrder: 1,
    },
    {
      name: 'Standard',
      displayName: 'Standard',
      description: 'For growing organizations',
      priceMonthly: 450, priceQuarterly: 1200, priceYearly: 4500,
      userLimit: 500, storageGB: 100, branchLimit: 10,
      supportLevel: 'Email & Phone',
      customDomain: true,
      features: ['Everything in Basic', 'Advanced analytics', 'Phone support', 'Custom domain', 'Audit logs'],
      sortOrder: 2,
    },
    {
      name: 'Enterprise',
      displayName: 'Enterprise',
      description: 'For large-scale deployments',
      priceMonthly: 1250, priceQuarterly: 3400, priceYearly: 12500,
      userLimit: 2000, storageGB: 500, branchLimit: 50,
      supportLevel: '24/7 Dedicated',
      customDomain: true,
      features: ['Everything in Standard', 'Unlimited branches', '24/7 dedicated SLA', 'Custom integrations', 'Priority onboarding'],
      sortOrder: 3,
    },
  ];

  for (const plan of defaults) {
    const existing = await SubscriptionPlan.findOne({ name: plan.name });
    if (!existing) {
      await SubscriptionPlan.create(plan);
    }
  }

  console.log('Default subscription plans seeded');
};
