import redis from 'redis';

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

client.on('error', (error) => {
  console.error('Redis Error', error);
});

const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
};

export default connectRedis;
