import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const expenseServiceUrl = process.env.EXPENSE_SERVICE_URL || 'http://localhost:4400';

router.use(proxy(expenseServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/expenses${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Expense service proxy error', data: null, errors: err.message }),
}));

export default router;
