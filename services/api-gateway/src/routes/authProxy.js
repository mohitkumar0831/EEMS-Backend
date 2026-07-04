import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4100';

router.use(proxy(authServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/auth${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Auth service proxy error', data: null, errors: err.message }),
}));

export default router;
