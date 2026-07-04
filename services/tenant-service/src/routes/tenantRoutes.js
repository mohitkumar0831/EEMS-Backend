import express from 'express';
import { registerTenant, getAllTenants, getTenantBySlug, validateTenant } from '../controllers/tenantController.js';
import { authenticate, authorize } from '../middlewares/authenticate.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { registerTenantSchema } from '../validators/tenantValidator.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => res.json({ success: true, message: 'Tenant service healthy' }));

// Validate tenant (called by API Gateway)
router.get('/validate', validateTenant);

// Register a new tenant company — super_admin only
router.post(
  '/register',
  authenticate,
  authorize('super_admin'),
  validateRequest(registerTenantSchema),
  registerTenant
);

// List all tenants — super_admin only
router.get('/', authenticate, authorize('super_admin'), getAllTenants);

// Get tenant by slug — super_admin only
router.get('/:slug', authenticate, authorize('super_admin'), getTenantBySlug);

export default router;
