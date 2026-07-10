import { publishEvent } from '../config/rabbitmq.js';

export const sendSubscriptionCreatedEvent = async (payload) => {
  await publishEvent('ems.events', 'billing.subscription_created', payload);
};

export const sendSubscriptionActivatedEvent = async (payload) => {
  await publishEvent('ems.events', 'billing.subscription_activated', payload);
};

export const sendSubscriptionExpiredEvent = async (payload) => {
  await publishEvent('ems.events', 'billing.subscription_expired', payload);
};

export const sendSubscriptionSuspendedEvent = async (payload) => {
  await publishEvent('ems.events', 'billing.subscription_suspended', payload);
};

export const sendPaymentSuccessEvent = async (payload) => {
  await publishEvent('ems.events', 'billing.payment_success', payload);
};

export const sendNotificationEvent = async (routingKey, payload) => {
  await publishEvent('ems.events', routingKey, payload);
};
