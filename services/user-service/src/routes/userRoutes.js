import express from 'express';
import { createEmployee, getEmployees, getEmployeesByManager, assignManager, getDashboardStats } from '../controllers/userController.js';
import { createEmployeeSchema, updateEmployeeSchema, assignManagerSchema } from '../validators/userValidator.js';
import { tenantContext } from '../middlewares/tenantContext.js';

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  next();
};

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'User service is healthy' }));

// SuperAdmin dashboard
router.get('/dashboard/stats', getDashboardStats);

router.use(tenantContext);

// Employee management routes (supports both with and without slug in URL)
router.post('/employees', validateRequest(createEmployeeSchema), createEmployee);
router.get('/employees', getEmployees);

router.post('/tenant/:slug/employees', validateRequest(createEmployeeSchema), createEmployee);
router.get('/tenant/:slug/employees', getEmployees);
router.get('/tenant/:slug/manager/:managerId/employees', getEmployeesByManager);
router.patch('/tenant/:slug/employees/:employeeId/manager', validateRequest(assignManagerSchema), assignManager);

export default router;
