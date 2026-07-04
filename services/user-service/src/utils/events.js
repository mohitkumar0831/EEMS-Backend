import amqp from 'amqplib';

export const publishEvent = async (exchange, routingKey, payload) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || process.env.RABBITMQ_URI);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RabbitMQ] Error publishing event:', error);
  }
};

export const sendEvent = async (eventName, payload) => {
  await publishEvent('ems.events', eventName, payload);
};
