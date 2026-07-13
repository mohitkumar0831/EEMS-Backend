import express from 'express';
import proxy from 'express-http-proxy';

const router = express.Router();
const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4500';

router.use('/', proxy(notificationServiceUrl, {
  proxyReqPathResolver: (req) => req.originalUrl,
  proxyErrorHandler: (err, res) => res.status(500).json({ success: false, message: 'Notification service proxy error', data: null, errors: err.message }),
}));

export default router;
