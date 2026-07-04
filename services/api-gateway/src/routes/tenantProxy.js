import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://localhost:4200';

router.use(proxy(tenantServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/tenants${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Tenant service proxy error', data: null, errors: err.message }),
}));

export default router;
