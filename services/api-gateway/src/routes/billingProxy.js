import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const billingServiceUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:4800';

router.use(proxy(billingServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/billing${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Billing service proxy error', data: null, errors: err.message }),
}));

export default router;
