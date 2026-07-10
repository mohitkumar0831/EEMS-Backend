import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import auditRoutes from './src/routes/auditRoutes.js';
import { startEventListener } from './src/listeners/eventListener.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4900;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/v1/audit', auditRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', service: 'audit-service' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

connectDB().then(() => {
  startEventListener();
  app.listen(PORT, () => {
    console.log(`Audit Service running on port ${PORT}`);
  });
});
