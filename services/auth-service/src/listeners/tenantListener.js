import { subscribeToQueue } from '../config/rabbitmq.js';
import { createCompanyAdmin, createEmployeeUser } from '../services/authService.js';

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

  // eslint-disable-next-line no-console
  console.log('[Auth] Listening for tenant.registered and employee.registered events');
};
