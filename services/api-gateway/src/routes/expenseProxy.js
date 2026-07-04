import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const expenseServiceUrl = process.env.EXPENSE_SERVICE_URL || 'http://localhost:4400';

router.use('/', proxy(expenseServiceUrl, {
  parseReqBody: (req) => {
    // If it's a multipart request (file upload), DO NOT parse the body in the proxy.
    // Let it stream raw to the expense service.
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      return false;
    }
    return true; // parse JSON/urlencoded bodies normally
  },
  proxyReqPathResolver: (req) => req.originalUrl,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Expense service proxy error', data: null, errors: err.message }),
}));

export default router;
