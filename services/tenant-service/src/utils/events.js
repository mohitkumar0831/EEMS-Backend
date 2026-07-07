import { publishEvent } from '../config/rabbitmq.js';

export const sendTenantRegisteredEvent = async (payload) => {
  await publishEvent('ems.events', 'tenant.registered', payload);
};

export const sendNotificationEvent = async (routingKey, payload) => {
  await publishEvent('ems.events', routingKey, payload);
};

export const sendTenantDeletedEvent = async (payload) => {
  await publishEvent('ems.events', 'tenant.deleted', payload);
};
