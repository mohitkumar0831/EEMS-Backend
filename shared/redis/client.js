import redis from 'redis';
import config from '../config/index.js';

const client = redis.createClient({
  socket: { host: config.redis.host, port: config.redis.port },
  password: config.redis.password || undefined,
});

client.on('error', (error) => {
  console.error('Redis error', error);
});

export const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
};

export default client;
