import { subscribeToQueue } from '../config/rabbitmq.js';
import Tenant from '../models/Tenant.js';

const tenantListener = async () => {
  await subscribeToQueue(
    'ems.events',
    'billing.subscription_activated',
    'tenant.subscription_activated_queue',
    async ({ tenantId, planName, userLimit, storageGB, branchLimit, billingCycle, endDate }) => {
      console.log(`[Tenant Service] Updating subscription for tenant ${tenantId}`);
      try {
        const updateFields = {
          subscriptionPlan: planName,
          billingCycle: billingCycle || 'Monthly',
        };

        if (userLimit !== undefined) updateFields.employeeCapacity = userLimit;
        if (storageGB !== undefined) updateFields.storageLimitGb = storageGB;
        if (branchLimit !== undefined) updateFields.branchCapacity = branchLimit;

        const updatedTenant = await Tenant.findByIdAndUpdate(
          tenantId,
          updateFields,
          { new: true }
        );

        if (!updatedTenant) {
          console.error(`[Tenant Service] Tenant not found for ID: ${tenantId}`);
        } else {
          console.log(`[Tenant Service] Successfully updated tenant ${tenantId} (${updatedTenant.companyName}) to plan ${planName}`);
        }
      } catch (err) {
        console.error(`[Tenant Service] Failed to update tenant ${tenantId}:`, err.message);
      }
    }
  );

  console.log('[Tenant Service] All listeners active');
};

export default tenantListener;
