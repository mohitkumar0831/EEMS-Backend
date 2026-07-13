import express from 'express';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getNotifications);
router.put('/:id/read', markRead);
router.put('/read-all', markAllRead);

export default router;
