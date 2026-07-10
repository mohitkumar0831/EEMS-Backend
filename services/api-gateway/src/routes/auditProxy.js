import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const auditServiceUrl = process.env.AUDIT_SERVICE_URL || 'http://localhost:4900';

router.use(proxy(auditServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/audit${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Audit service proxy error', data: null, errors: err.message }),
}));

export default router;
