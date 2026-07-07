import { subscribeToQueue } from '../config/rabbitmq.js';
import { createCompanyAdmin, createEmployeeUser } from '../services/authService.js';
import User from '../models/User.js';

export const startTenantListener = async () => {
  await subscribeToQueue(
    'ems.events',
    'tenant.registered',
    'auth.tenant.registered',
    async (payload) => {
      // eslint-disable-next-line no-console
      console.log('[Auth] Received tenant.registered event:', payload.adminEmail);
      await createCompanyAdmin(payload); // payload now includes tenantSlug
    }
  );
  
  await subscribeToQueue(
    'ems.events',
    'employee.registered',
    'auth.employee.registered',
    async (payload) => {
      // eslint-disable-next-line no-console
      console.log('[Auth] Received employee.registered event:', payload.email);
      await createEmployeeUser(payload);
    }
  );

  await subscribeToQueue(
    'ems.events',
    'tenant.deleted',
    'auth.tenant.deleted',
    async (payload) => {
      console.log(`[Auth] Received tenant.deleted event for tenant: ${payload.tenantId}`);
      try {
        await User.deleteMany({ tenantId: payload.tenantId });
        console.log(`[Auth] Wiped all users for tenant: ${payload.tenantId}`);
      } catch (err) {
        console.error(`[Auth] Error wiping users for tenant ${payload.tenantId}:`, err);
      }
    }
  );

  // eslint-disable-next-line no-console
  console.log('[Auth] Listening for tenant and employee events');
};
