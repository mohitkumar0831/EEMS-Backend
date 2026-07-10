import express from 'express';
import {
  login,
  tenantLogin,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  changePassword,
  registerSuperAdmin,
  getDashboardStats,
  getTenantUserCounts,
  requestTenantPasswordReset,
  getCompanyAdmin,
} from '../controllers/authController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerSuperAdminSchema,
} from '../validators/authValidator.js';
import { authenticate, authorize } from '../middlewares/authenticate.js';

const router = express.Router();

// Super admin registration (one-time)
router.post('/register-super-admin', validateRequest(registerSuperAdminSchema), registerSuperAdmin);

// Dashboard stats
router.get('/stats/dashboard', authenticate, authorize('super_admin'), getDashboardStats);
router.get('/stats/tenant-user-counts', authenticate, authorize('super_admin'), getTenantUserCounts);

// General login (super_admin)
router.post('/login', validateRequest(loginSchema), login);

// Tenant-specific login — URL received in welcome email
// POST /api/v1/auth/tenant/:slug/login  { email, password }
router.post('/tenant/:slug/login', validateRequest(loginSchema), tenantLogin);

// Add a GET handler so if they click the link in their email, they see a helpful message instead of an error
router.get('/tenant/:slug/login', (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to ${req.params.slug}! To log in, please send a POST request to this URL with your email and password.`,
    data: {
      companyName: req.params.slug,
      url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/${req.params.slug}`,
      slug: req.params.slug
    }
  });
});

// Token management
router.post('/refresh-token', validateRequest(refreshSchema), refreshToken);

// Password management
router.post('/forgot-password', validateRequest(forgotPasswordSchema), requestPasswordReset);
router.post('/tenant/:slug/forgot-password', validateRequest(forgotPasswordSchema), requestTenantPasswordReset);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), changePassword);

// Get company admin for a tenant — accessible to any authenticated tenant user
router.get('/tenant/:slug/company-admin', authenticate, getCompanyAdmin);

export default router;
