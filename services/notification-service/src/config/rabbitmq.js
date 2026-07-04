import amqplib from 'amqplib';

let connection;
let channel;

const connectWithRetry = async (url, retries = 10, delayMs = 3000) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await amqplib.connect(url);
      return conn;
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.warn(`RabbitMQ connect attempt ${attempt} failed, retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};

export const connectRabbitMQ = async () => {
  if (channel) return channel;
  connection = await connectWithRetry(process.env.RABBITMQ_URL || 'amqp://localhost');
  channel = await connection.createChannel();
  return channel;
};

export const publishEvent = async (exchange, routingKey, payload) => {
  const ch = await connectRabbitMQ();
  await ch.assertExchange(exchange, 'topic', { durable: true });
  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
};

/**
 * Subscribe to a topic-exchange routing key pattern.
 */
export const subscribeToQueue = async (exchange, pattern, queue, handler) => {
  const ch = await connectRabbitMQ();
  await ch.assertExchange(exchange, 'topic', { durable: true });
  await ch.assertQueue(queue, { durable: true });
  await ch.bindQueue(queue, exchange, pattern);
  ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload);
      ch.ack(msg);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[RabbitMQ] Error processing message on queue "${queue}":`, err.message);
      ch.nack(msg, false, false);
    }
  });
};
