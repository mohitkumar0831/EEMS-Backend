import express from 'express';
import {
  createExpense,
  getExpensesByEmployee,
  getExpensesForManager,
  getExpenseById,
  updateExpenseStatus,
  getAllExpenses,
  uploadReceipt,
  getReceiptById,
  processPayout,
} from '../controllers/expenseController.js';
import { createExpenseSchema, updateExpenseStatusSchema, processPayoutSchema } from '../validators/expenseValidator.js';
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

router.use(tenantContext);

router.get('/health', (req, res) => res.json({ success: true, message: 'Expense service is healthy' }));

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

// Get expenses by employee
router.get('/tenant/:slug/employee/:employeeId', getExpensesByEmployee);

// Get expenses pending for a manager
router.get('/tenant/:slug/manager/:managerId', getExpensesForManager);

// Get single expense by ID
router.get('/tenant/:slug/:id', getExpenseById);

// Update expense status (manager/finance/auditor approval)
router.patch('/tenant/:slug/:id/status', validateRequest(updateExpenseStatusSchema), updateExpenseStatus);

// Process payout (finance team)
router.post('/tenant/:slug/:id/payout', validateRequest(processPayoutSchema), processPayout);

export default router;
