import express from 'express';
import {
  createExpense,
  getExpensesByEmployee,
  getEmployeeReimbursementSummary,
  getExpensesForManager,
  getExpenseById,
  updateExpenseStatus,
  getAllExpenses,
  uploadReceipt,
  getReceiptById,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPayoutsByFinanceUser,
  getFinanceDashboard,
  getAuditorDashboard,
  getAdminDashboard,
  getDashboardStats,
  getManagerDashboard,
  getEmployeeDashboard,
  getTotalReimbursed,
  getPolicies,
  createOrUpdatePolicyCtrl,
  updatePolicyByIdCtrl
} from '../controllers/expenseController.js';
import { createExpenseSchema, updateExpenseStatusSchema, createRazorpayOrderSchema, verifyRazorpayPaymentSchema } from '../validators/expenseValidator.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { upload } from '../middlewares/upload.js';

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

router.get('/health', (req, res) => res.json({ success: true, message: 'Expense service is healthy' }));

// SuperAdmin dashboard
router.get('/dashboard/stats', getDashboardStats);

router.use(tenantContext);

// ─── Receipt Upload + OCR ──────────────────────────────────────────────────

// Upload a receipt (PDF/image) and run OCR scan
router.post('/tenant/:slug/receipts/upload', upload.single('receipt'), uploadReceipt);

// Get receipt details (OCR data, file info)
router.get('/tenant/:slug/receipts/:id', getReceiptById);

// ─── Expense CRUD ──────────────────────────────────────────────────────────

// Create a new expense (employee submits)
router.post('/tenant/:slug', validateRequest(createExpenseSchema), createExpense);

// Get all expenses (admin/finance — with optional query filters ?status=&employeeId=&category=)
router.get('/tenant/:slug', getAllExpenses);

// GET employee's own expenses
router.get('/tenant/:slug/employee/:employeeId', getExpensesByEmployee);

// GET employee reimbursement summary
router.get('/tenant/:slug/employee/:employeeId/reimbursements/summary', getEmployeeReimbursementSummary);

// GET employee total reimbursed amount
router.get('/tenant/:slug/employee/:employeeId/total-reimbursed', getTotalReimbursed);

// Get expenses pending for a manager
router.get('/tenant/:slug/manager/:managerId', getExpensesForManager);

// Get payouts processed by a specific finance user
router.get('/tenant/:slug/finance/:financeId/payouts', getPayoutsByFinanceUser);

// Finance Dashboard Metrics
router.get('/tenant/:slug/finance/dashboard', getFinanceDashboard);

// Auditor Dashboard Metrics
router.get('/tenant/:slug/auditor/dashboard', getAuditorDashboard);

// Admin Dashboard Metrics
router.get('/tenant/:slug/admin/dashboard', getAdminDashboard);

// Manager Dashboard Metrics
router.get('/tenant/:slug/manager/:managerId/dashboard', getManagerDashboard);

// Employee Dashboard Metrics
router.get('/tenant/:slug/employee/:employeeId/dashboard', getEmployeeDashboard);

// ─── Expense Policy Management ──────────────────────────────────────────────
router.get('/tenant/:slug/policies', getPolicies);
router.post('/tenant/:slug/policies', createOrUpdatePolicyCtrl);
router.patch('/tenant/:slug/policies/:id', updatePolicyByIdCtrl);

// ─── Wildcard / Parameter Routes (Must be at the bottom) ───────────────────

// Get single expense by ID
router.get('/tenant/:slug/:id', getExpenseById);

// Update expense status (manager/finance/auditor approval)
router.patch('/tenant/:slug/:id/status', validateRequest(updateExpenseStatusSchema), updateExpenseStatus);

// Process payout (finance team) - Razorpay Integration
router.post('/tenant/:slug/:id/create-razorpay-order', validateRequest(createRazorpayOrderSchema), createRazorpayOrder);
router.post('/tenant/:slug/:id/verify-razorpay-payment', validateRequest(verifyRazorpayPaymentSchema), verifyRazorpayPayment);

export default router;
