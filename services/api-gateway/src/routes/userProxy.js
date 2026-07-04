import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4300';

router.use(proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/v1/users${req.url}`,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'User service proxy error', data: null, errors: err.message }),
}));

export default router;
