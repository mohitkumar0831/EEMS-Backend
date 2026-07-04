import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectRedis from './src/config/redis.js';
import { connectRabbitMQ } from './src/config/rabbitmq.js';
import workflowRoutes from './src/routes/workflowRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4700;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.use('/api/v1/workflows', workflowRoutes);
app.use(errorHandler);

const start = async () => {
  await connectRedis();
  await connectRabbitMQ();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Workflow Service listening on port ${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Workflow service failed to start', error);
  process.exit(1);
});
