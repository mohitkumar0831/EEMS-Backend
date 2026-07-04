import express from 'express';
const router = express.Router();
router.get('/health', (req, res) => res.json({ success: true, message: 'Workflow service is healthy' }));
export default router;
