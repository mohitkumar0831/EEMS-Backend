import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import connectRedis from './src/config/redis.js';
import { connectRabbitMQ } from './src/config/rabbitmq.js';
import notificationListener from './src/listeners/notificationListener.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { initSocketServer } from './src/socket/socketServer.js';

dotenv.config();
const app = express();
const httpServer = http.createServer(app);
initSocketServer(httpServer);
const PORT = process.env.PORT || 4500;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.get('/health', (req, res) => res.json({ success: true, message: 'Notification service healthy' }));
app.use('/api/v1/notifications', notificationRoutes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await connectRedis();
  await connectRabbitMQ();
  await notificationListener();
  httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Notification Service listening on port ${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Notification service failed to start', error);
  process.exit(1);
});
