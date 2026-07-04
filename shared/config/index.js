import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  app: {
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/ems',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  email: {
    host: process.env.EMAIL_HOST || 'localhost',
    port: Number(process.env.EMAIL_PORT || 587),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'no-reply@ems.com',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:4100',
    tenant: process.env.TENANT_SERVICE_URL || 'http://tenant-service:4200',
    user: process.env.USER_SERVICE_URL || 'http://user-service:4300',
    expense: process.env.EXPENSE_SERVICE_URL || 'http://expense-service:4400',
  },
  appPort: Number(process.env.PORT || 3000),
  rateLimit: {
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW || 15),
    maxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
  },
};

export default config;
