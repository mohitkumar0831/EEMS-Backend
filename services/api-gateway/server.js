import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler } from './src/middlewares/errorHandler.js';
import tenantValidation from './src/middlewares/tenantValidation.js';
import authProxy from './src/routes/authProxy.js';
import tenantProxy from './src/routes/tenantProxy.js';
import userProxy from './src/routes/userProxy.js';
import expenseProxy from './src/routes/expenseProxy.js';
import dashboardRoute from './src/routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 10000, // Increased for dev
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use('/api/v1/auth', authProxy);
app.use('/api/v1/dashboard', dashboardRoute);
app.use('/api/v1/tenants', tenantProxy);
app.use('/api/v1/users', tenantValidation, userProxy);
app.use('/api/v1/expenses', tenantValidation, expenseProxy);

app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway is running on port ${PORT}`);
});
