import express from 'express';
import { registerTenant, getAllTenants, getTenantBySlug, validateTenant, getDashboardStats, getTenantsSummary, updateTenantStatus, deleteTenant, getCompanyAdmins } from '../controllers/tenantController.js';
import { authenticate, authorize } from '../middlewares/authenticate.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { registerTenantSchema } from '../validators/tenantValidator.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => res.json({ success: true, message: 'Tenant service healthy' }));

// SuperAdmin dashboard stats
router.get('/dashboard/stats', authenticate, authorize('super_admin'), getDashboardStats);

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

// Get tenant summary — super_admin only
router.get('/summary', authenticate, authorize('super_admin'), getTenantsSummary);

// Get company admins — super_admin only
router.get('/company-admins', authenticate, authorize('super_admin'), getCompanyAdmins);

// Get a specific tenant by slug — super_admin only
router.get('/:slug', authenticate, authorize('super_admin'), getTenantBySlug);

// Update a tenant's status (Pause/Resume) — super_admin only
router.patch('/:slug/status', authenticate, authorize('super_admin'), updateTenantStatus);

// Delete a tenant (Soft Delete) — super_admin only
router.delete('/:slug', authenticate, authorize('super_admin'), deleteTenant);

export default router;
