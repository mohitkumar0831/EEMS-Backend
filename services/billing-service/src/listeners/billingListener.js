import { connectRabbitMQ } from '../config/rabbitmq.js';
import * as subscriptionService from '../services/subscriptionService.js';
import * as planService from '../services/planService.js';

/**
 * Listen for events from other services (e.g., tenant.registered)
 * to automatically create subscriptions when tenants are created.
 */
export const startBillingEventListeners = async () => {
  const channel = await connectRabbitMQ();
  const exchange = 'ems.events';

  await channel.assertExchange(exchange, 'topic', { durable: true });

  // ─── Listen for Tenant Registration ──────────────────
  const tenantQueue = 'billing.tenant_registered';
  await channel.assertQueue(tenantQueue, { durable: true });
  await channel.bindQueue(tenantQueue, exchange, 'tenant.registered');

  channel.consume(tenantQueue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log('[BILLING LISTENER] Received tenant.registered event:', data.tenantSlug);

      // Find the plan by name (from tenant registration data) or use default
      let plan;
      try {
        plan = await planService.getPlanByName(data.subscriptionPlan || 'Free');
      } catch {
        // If plan not found, try to get default plan
        const allPlans = await planService.getAllPlans();
        plan = allPlans.find(p => p.isDefault) || allPlans[0];
      }

      if (plan) {
        // Check if subscription already exists (idempotency)
        try {
          await subscriptionService.getSubscriptionByTenantId(data.tenantId);
          console.log(`[BILLING LISTENER] Subscription already exists for tenant ${data.tenantSlug}, skipping`);
        } catch {
          // No existing subscription — create one
          await subscriptionService.createSubscription({
            tenantId: data.tenantId,
            tenantSlug: data.tenantSlug,
            companyName: data.companyName || data.tenantSlug,
            planId: plan._id.toString(),
            billingCycle: data.billingCycle || 'Monthly',
            trialDays: plan.name === 'Free' ? 0 : 14,
          });
          console.log(`[BILLING LISTENER] Subscription created for tenant ${data.tenantSlug} on ${plan.name} plan`);
        }
      }

      channel.ack(msg);
    } catch (error) {
      console.error('[BILLING LISTENER] Error processing tenant.registered:', error);
      channel.nack(msg, false, true); // Requeue on failure
    }
  });

  // ─── Listen for Tenant Deletion ──────────────────────
  const deleteQueue = 'billing.tenant_deleted';
  await channel.assertQueue(deleteQueue, { durable: true });
  await channel.bindQueue(deleteQueue, exchange, 'tenant.deleted');

  channel.consume(deleteQueue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log('[BILLING LISTENER] Received tenant.deleted event:', data.slug);

      // Soft-delete the subscription
      const Subscription = (await import('../models/Subscription.js')).default;
      await Subscription.updateMany(
        { tenantId: data.tenantId },
        { isDeleted: true, status: 'Cancelled' }
      );

      console.log(`[BILLING LISTENER] Subscription cancelled for deleted tenant ${data.slug}`);
      channel.ack(msg);
    } catch (error) {
      console.error('[BILLING LISTENER] Error processing tenant.deleted:', error);
      channel.nack(msg, false, true);
    }
  });

  console.log('[BILLING LISTENER] Billing event listeners started');
};
