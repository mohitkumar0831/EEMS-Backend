import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import connectRedis from './src/config/redis.js';
import { connectRabbitMQ } from './src/config/rabbitmq.js';
import tenantRoutes from './src/routes/tenantRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import tenantListener from './src/listeners/tenantListener.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4200;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.use('/api/v1/tenants', tenantRoutes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await connectRedis();
  await connectRabbitMQ();
  await tenantListener();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Tenant Service listening on port ${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Tenant service failed to start', error);
  process.exit(1);
});
