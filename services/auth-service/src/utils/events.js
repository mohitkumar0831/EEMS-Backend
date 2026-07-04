import { publishEvent } from '../config/rabbitmq.js';

export const sendNotificationEvent = async (routingKey, payload) => {
  await publishEvent('ems.events', routingKey, payload);
};
