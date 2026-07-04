import amqplib from 'amqplib';
import config from '../config/index.js';
import logger from '../logger/index.js';

let connection;
let channel;

export const connectRabbitMQ = async () => {
  if (channel) return channel;
  connection = await amqplib.connect(config.rabbitmq.url);
  channel = await connection.createChannel();
  return channel;
};

export const publishEvent = async (exchange, routingKey, payload) => {
  const channelInstance = await connectRabbitMQ();
  await channelInstance.assertExchange(exchange, 'topic', { durable: true });
  channelInstance.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
};

export const consumeQueue = async (queue, onMessage) => {
  const channelInstance = await connectRabbitMQ();
  await channelInstance.assertQueue(queue, { durable: true });
  await channelInstance.consume(queue, async (message) => {
    if (message) {
      try {
        const payload = JSON.parse(message.content.toString());
        await onMessage(payload);
        channelInstance.ack(message);
      } catch (error) {
        logger.error('RabbitMQ consumer error %o', error);
        channelInstance.nack(message, false, false);
      }
    }
  });
};
