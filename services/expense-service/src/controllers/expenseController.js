import * as expenseService from '../services/expenseService.js';

// POST /expenses — Employee submits an expense
export const createExpense = async (req, res, next) => {
  try {
    const expense = await expenseService.createExpense(req.tenant, req.body);
    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// POST /receipts/upload — Upload receipt + OCR scan
export const uploadReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a receipt (PDF, JPEG, PNG, or WebP).',
      });
    }

    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required in the request body.',
      });
    }

    const receipt = await expenseService.uploadAndScanReceipt(req.tenant, req.file, employeeId);

    res.status(201).json({
      success: true,
      message: receipt.ocrStatus === 'completed'
        ? 'Receipt uploaded and scanned successfully'
        : 'Receipt uploaded but OCR extraction failed — you may enter details manually',
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

// GET /receipts/:id — Get receipt by ID
export const getReceiptById = async (req, res, next) => {
  try {
    const receipt = await expenseService.getReceiptById(req.tenant, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Receipt retrieved successfully',
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

// GET /expenses/employee/:employeeId — Employee views their own expenses
export const getExpensesByEmployee = async (req, res, next) => {
  try {
    const expenses = await expenseService.getExpensesByEmployee(req.tenant, req.params.employeeId);
    res.status(200).json({
      success: true,
      message: 'Expenses retrieved successfully',
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

// GET /expenses/manager/:managerId — Manager views pending approvals
export const getExpensesForManager = async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const expenses = await expenseService.getExpensesForManager(req.tenant, req.params.managerId, filters);
    res.status(200).json({
      success: true,
      message: 'Pending expenses retrieved successfully',
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

// GET /expenses/:id — Get single expense by ID
export const getExpenseById = async (req, res, next) => {
  try {
    const expense = await expenseService.getExpenseById(req.tenant, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Expense retrieved successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /expenses/:id/status — Manager/Finance/Auditor updates status
export const updateExpenseStatus = async (req, res, next) => {
  try {
    const expense = await expenseService.updateExpenseStatus(req.tenant, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Expense status updated successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// GET /expenses — Admin/Finance get all expenses with optional filters
export const getAllExpenses = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || null,
      employeeId: req.query.employeeId || null,
      category: req.query.category || null,
    };
    const expenses = await expenseService.getAllExpenses(req.tenant, filters);
    res.status(200).json({
      success: true,
      message: 'All expenses retrieved successfully',
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

// GET /expenses/finance/:financeId/payouts
export const getPayoutsByFinanceUser = async (req, res, next) => {
  try {
    const payouts = await expenseService.getPayoutsByFinanceUser(req.tenant, req.params.financeId);
    res.status(200).json({
      success: true,
      message: 'Finance payout history retrieved successfully',
      data: payouts,
    });
  } catch (error) {
    next(error);
  }
};

// POST /expenses/:id/create-razorpay-order
export const createRazorpayOrder = async (req, res, next) => {
  try {
    const orderData = await expenseService.createRazorpayOrder(req.tenant, req.params.id, req.body.actionBy);
    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: orderData,
    });
  } catch (error) {
    next(error);
  }
};

// POST /expenses/:id/verify-razorpay-payment
export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const expense = await expenseService.verifyRazorpayPayment(req.tenant, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Payment verified and payout processed successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

export const getFinanceDashboard = async (req, res, next) => {
  try {
    const metrics = await expenseService.getFinanceDashboardMetrics(req.tenant);
    res.status(200).json({
      success: true,
      message: 'Finance dashboard metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditorDashboard = async (req, res, next) => {
  try {
    const metrics = await expenseService.getAuditorDashboardMetrics(req.tenant);
    res.status(200).json({
      success: true,
      message: 'Auditor dashboard metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboard = async (req, res, next) => {
  try {
    const metrics = await expenseService.getAdminDashboardMetrics(req.tenant);
    res.status(200).json({
      success: true,
      message: 'Admin dashboard metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};
