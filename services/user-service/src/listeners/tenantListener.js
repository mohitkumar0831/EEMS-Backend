import { subscribeToQueue } from '../config/rabbitmq.js';
import { User } from '../models/Employee.js';

export const startTenantListener = async () => {
  await subscribeToQueue(
    'ems.events',
    'tenant.deleted',
    'user.tenant.deleted',
    async (payload) => {
      console.log(`[User] Received tenant.deleted event for tenant: ${payload.tenantId}`);
      try {
        await User.deleteMany({ tenantId: payload.tenantId });
        console.log(`[User] Wiped all users for tenant: ${payload.tenantId}`);
      } catch (err) {
        console.error(`[User] Error wiping employees for tenant ${payload.tenantId}:`, err);
      }
    }
  );

  console.log('[User] Listening for tenant events');
};
