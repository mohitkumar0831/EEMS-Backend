import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import connectRedis from './src/config/redis.js';
import { connectRabbitMQ } from './src/config/rabbitmq.js';
import billingRoutes from './src/routes/billingRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { startSubscriptionCron } from './src/jobs/subscriptionCron.js';
import { startBillingEventListeners } from './src/listeners/billingListener.js';
import { seedDefaultPlans } from './src/services/planService.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4800;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.use('/api/v1/billing', billingRoutes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await seedDefaultPlans();
  await connectRedis();
  await connectRabbitMQ();
  await startBillingEventListeners();
  startSubscriptionCron();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Billing Service listening on port ${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Billing service failed to start', error);
  process.exit(1);
});
