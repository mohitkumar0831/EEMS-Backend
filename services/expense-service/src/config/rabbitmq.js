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
