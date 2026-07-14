import { getTenantModel } from '../config/db.js';
import { expenseSchema } from '../models/Expense.js';
import { receiptSchema } from '../models/Receipt.js';
import { processReceipt } from '../utils/ocr.js';
import { parseReceiptText } from '../utils/receiptParser.js';
import { publishEvent } from '../config/rabbitmq.js';
import { createOrder, verifySignature, generatePayoutReceipt } from './payoutService.js';
import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';

const uploadToCloudinary = (buffer, retries = 3) => {
  return new Promise((resolve, reject) => {
    const attemptUpload = (attempt) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'receipts', timeout: 120000 }, // Increased timeout
        (error, result) => {
          if (error) {
            console.error(`Cloudinary upload attempt ${attempt} failed:`, error.message || error);
            if (attempt < retries) {
              console.log(`Retrying Cloudinary upload (${attempt + 1}/${retries})...`);
              return setTimeout(() => attemptUpload(attempt + 1), 2000); // Wait 2s before retry
            }
            return reject(error);
          }
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    };
    attemptUpload(1);
  });
};

// ─── Upload & OCR Receipt ───────────────────────────────────────────────────
export const uploadAndScanReceipt = async (tenantContext, file, employeeId) => {
  const { dbName, id: tenantId } = tenantContext;
  const Receipt = getTenantModel(dbName, 'Receipt', receiptSchema);

  // Fix for old unique indexes: drop indexes not in current schema
  try {
    await Receipt.syncIndexes();
  } catch (err) {
    console.error('Error syncing indexes:', err);
  }

  // 1. Upload file buffer to Cloudinary
  let cloudinaryResult;
  try {
    cloudinaryResult = await uploadToCloudinary(file.buffer);
  } catch (err) {
    console.error('Cloudinary Upload Error Details:', err);
    throw { status: 500, message: 'Failed to upload receipt to Cloudinary', error: err };
  }

  // 2. Create receipt record with status = processing
  const receipt = await Receipt.create({
    originalName: file.originalname,
    fileName: cloudinaryResult.public_id,
    filePath: cloudinaryResult.secure_url,
    mimeType: file.mimetype,
    fileSize: file.size,
    employeeId,
    tenantId,
    ocrStatus: 'processing',
  });

  // 3. Run OCR using the buffer (async but we await it here)
  try {
    const { text, confidence } = await processReceipt(file.buffer, file.mimetype);
    const extractedData = parseReceiptText(text);

    receipt.rawText = text;
    receipt.ocrConfidence = confidence;
    receipt.extractedData = extractedData;
    receipt.ocrStatus = text && text.trim().length > 0 ? 'completed' : 'failed';
    if (!text || text.trim().length === 0) {
      receipt.ocrError = 'No text could be extracted from this file';
    }
    await receipt.save();
  } catch (err) {
    receipt.ocrStatus = 'failed';
    receipt.ocrError = err.message;
    await receipt.save();
  }

  return receipt;
};

// ─── Get Receipt by ID ──────────────────────────────────────────────────────
export const getReceiptById = async (tenantContext, receiptId) => {
  const { dbName } = tenantContext;
  const Receipt = getTenantModel(dbName, 'Receipt', receiptSchema);

  const receipt = await Receipt.findById(receiptId);
  if (!receipt) {
    throw { status: 404, message: 'Receipt not found' };
  }
  return receipt;
};

// ─── Create Expense ─────────────────────────────────────────────────────────
export const createExpense = async (tenantContext, expenseData) => {
  const { dbName, id: tenantId } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const expense = await Expense.create({
    ...expenseData,
    tenantId,
    submittedAt: expenseData.status === 'Draft' ? null : new Date(),
  });

  // Notify manager, finance, and auditors via RabbitMQ if it's submitted
  if (expense.status === 'Submitted') {
    try {
      await publishEvent('ems.events', 'notification.expense.created', {
        tenantId,
        managerId: expense.assignedManagerId,
        expenseId: expense._id,
        employeeName: expenseData.employeeName || 'An Employee',
        amount: expense.amount
      });
    } catch (err) {
      console.error('Failed to publish expense.created event:', err);
    }
  }

  return expense;
};

// ─── Get All Expenses (for employee – their own) ────────────────────────────
export const getExpensesByEmployee = async (tenantContext, employeeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  return Expense.find({ employeeId }).populate('receiptId').sort({ createdAt: -1 });
};

// ─── Get Employee Reimbursement Summary ─────────────────────────────────────
export const getEmployeeReimbursementSummary = async (tenantContext, employeeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema);

  const expenses = await Expense.find({ employeeId }).populate('receiptId').sort({ createdAt: -1 });

  const totalReimbursed = expenses
    .filter(e => e.status === 'Paid')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingAmount = expenses
    .filter(e => !['Paid', 'Rejected'].includes(e.status))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    totalReimbursed,
    pendingAmount,
    expenses
  };
};

// ─── Get Total Reimbursed For Employee ──────────────────────────────────────
export const getTotalReimbursedForEmployee = async (tenantContext, employeeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  // Fetch all expenses for the employee
  const allExpenses = await Expense.find({ employeeId }).lean();
  
  // Filter for paid expenses (case-insensitive) or those that have progressed beyond Paid
  const paidExpenses = allExpenses.filter(exp => {
    const status = (exp.status || '').trim().toLowerCase();
    
    // If current status is one of the post-payment statuses
    if (['paid', 'audited', 'audit failed', 'flagged'].includes(status)) {
      return true;
    }
    
    // Or if it was ever marked as 'Paid' in the action history
    if (exp.actionHistory && Array.isArray(exp.actionHistory)) {
      return exp.actionHistory.some(history => (history.status || '').trim().toLowerCase() === 'paid');
    }
    
    return false;
  });
  
  const totalReimbursed = paidExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Return the total amount, the list of paid expenses, and all expenses for transparency
  return { 
    totalReimbursed, 
    paidExpenses,
    allExpenses // Included so the client can verify the current status of all their claims
  };
};


// ─── Get Expenses for Manager Approval ──────────────────────────────────────
export const getExpensesForManager = async (tenantContext, managerId, filters = {}) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const query = { assignedManagerId: managerId };
  if (filters.status) {
    query.status = filters.status;
  }

  return Expense.find(query).populate('receiptId').sort({ createdAt: -1 });
};

// ─── Get Single Expense ─────────────────────────────────────────────────────
export const getExpenseById = async (tenantContext, expenseId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const expense = await Expense.findById(expenseId).populate('receiptId');
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }
  return expense;
};

// ─── Update Expense Status (Manager/Finance/Auditor approvals) ──────────────
export const updateExpenseStatus = async (tenantContext, expenseId, statusData) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }

  // Update status and current remarks
  expense.status = statusData.status;
  expense.remarks = statusData.remarks || null;

  // Add to action history
  expense.actionHistory.push({
    status: statusData.status,
    actionBy: statusData.actionBy,
    remarks: statusData.remarks || null,
    actionAt: new Date(),
  });

  await expense.save();

  try {
    await publishEvent('ems.events', 'notification.expense.status_updated', {
      tenantId: expense.tenantId,
      expenseId: expense._id,
      employeeId: expense.employeeId,
      managerId: expense.assignedManagerId,
      status: expense.status,
      amount: expense.amount
    });
  } catch (err) {
    console.error('Failed to publish expense.status_updated event:', err);
  }

  return expense.populate('receiptId');
};

// ─── Get All Expenses (admin/finance view) ──────────────────────────────────
export const getAllExpenses = async (tenantContext, filters = {}) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const query = {};
  if (filters.status) {
    if (filters.status.includes(',')) {
      query.status = { $in: filters.status.split(',').map(s => s.trim()) };
    } else {
      query.status = filters.status;
    }
  }
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.category) query.category = filters.category;

  return Expense.find(query).populate('receiptId').sort({ createdAt: -1 });
};

// ─── Get Payout History for Finance User ────────────────────────────────────
export const getPayoutsByFinanceUser = async (tenantContext, financeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  // Find expenses where status is Paid AND the actionHistory contains a 'Paid' status by this finance user
  const query = {
    status: 'Paid',
    actionHistory: {
      $elemMatch: {
        status: 'Paid',
        actionBy: financeId
      }
    }
  };

  return Expense.find(query).populate('receiptId').sort({ updatedAt: -1 });
};

// ─── Create Razorpay Order (Finance Team) ──────────────────────────────────────────
export const createRazorpayOrder = async (tenantContext, expenseId, actionBy) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }

  // Check if expense is in a valid state to be paid
  if (!['Manager Approved', 'Finance Approved', 'Submitted'].includes(expense.status)) {
    throw { status: 400, message: 'Expense must be Manager Approved, Finance Approved, or Submitted before payout' };
  }

  // Generate a receipt ID placeholder or use mongo ID
  const receiptId = `rcpt_${expenseId.substring(0, 10)}`;

  // Create order via Razorpay API
  const order = await createOrder(expense.amount, receiptId);

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency
  };
};

// ─── Verify Razorpay Payment (Finance Team) ────────────────────────────────────────
export const verifyRazorpayPayment = async (tenantContext, expenseId, verificationData) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, actionBy, payoutRoute, paymentReference } = verificationData;

  // Verify the signature
  const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    throw { status: 400, message: 'Payment signature verification failed' };
  }

  // Generate PDF Receipt
  const receiptUrl = await generatePayoutReceipt(expense, {
    payoutRoute: payoutRoute || 'Razorpay Gateway',
    paymentReference: razorpay_payment_id,
    payoutId: razorpay_order_id
  });

  // Update Expense document
  expense.status = 'Paid';
  expense.payoutRoute = payoutRoute || 'Razorpay Gateway';
  expense.paymentReference = razorpay_payment_id;
  expense.razorpayPayoutId = razorpay_order_id;
  expense.payoutReceiptUrl = receiptUrl;

  // Add action history
  expense.actionHistory.push({
    status: 'Paid',
    actionBy: actionBy,
    remarks: 'Payout disbursed successfully via Razorpay (Payment ID: ' + razorpay_payment_id + ')',
    actionAt: new Date(),
  });

  await expense.save();

  return expense.populate('receiptId');
};

// ─── Get Employee Dashboard Metrics ───────────────────────────────────────────
export const getEmployeeDashboardMetrics = async (tenantContext, employeeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expenses = await Expense.find({ employeeId }).sort({ createdAt: -1 }).lean();

  let totalClaims = expenses.length;
  let pendingClaimsCount = 0;
  let approvedClaimsCount = 0;
  let totalReimbursed = 0;
  let totalReimbursedCount = 0;
  let flaggedClaimsCount = 0;
  const personalCategorySpend = {};
  const monthlyCategorySpend = {};

  for (const exp of expenses) {
    const status = (exp.status || '').trim().toLowerCase();
    
    if (['pending', 'submitted', 'under review'].includes(status)) {
      pendingClaimsCount++;
    }
    if (['approved', 'manager approved', 'finance approved'].includes(status)) {
      approvedClaimsCount++;
    }
    
    // Check if it's currently paid/post-paid or if it was ever marked as 'Paid' in history
    let isPaid = false;
    if (['paid', 'audited', 'audit failed', 'flagged'].includes(status)) {
      isPaid = true;
    } else if (exp.actionHistory && Array.isArray(exp.actionHistory)) {
      isPaid = exp.actionHistory.some(history => (history.status || '').trim().toLowerCase() === 'paid');
    }

    if (isPaid) {
      totalReimbursed += (exp.amount || 0);
      totalReimbursedCount++;
    }

    if (['under review', 'audit failed', 'flagged'].includes(status)) {
      flaggedClaimsCount++;
    }
    
    if (['approved', 'manager approved', 'finance approved'].includes(status) || isPaid) {
      personalCategorySpend[exp.category] = (personalCategorySpend[exp.category] || 0) + (exp.amount || 0);
      
      // Calculate monthly category spend
      const dateToUse = exp.date || exp.createdAt || new Date();
      const dateObj = new Date(dateToUse);
      const year = dateObj.getFullYear();
      const month = dateObj.toLocaleString('default', { month: 'short' });
      const key = `${month} ${year}`;
      
      if (!monthlyCategorySpend[key]) {
        monthlyCategorySpend[key] = {};
      }
      monthlyCategorySpend[key][exp.category] = (monthlyCategorySpend[key][exp.category] || 0) + (exp.amount || 0);
    }
  }

  const recentClaims = expenses.slice(0, 4);

  // Mocking policies and travel for now as they are not implemented in models
  const policies = [
    { id: 'pol-1', tenantId: tenantContext.id, category: 'Meals', limit: 100, rule: 'Dining rules' },
    { id: 'pol-2', tenantId: tenantContext.id, category: 'Travel', limit: 1500, rule: 'Accommodation/Tickets limit' }
  ];
  const recentTravel = [];

  return {
    totalClaims,
    pendingClaimsCount,
    approvedClaimsCount,
    totalReimbursed,
    totalReimbursedCount,
    flaggedClaimsCount,
    personalCategorySpend,
    monthlyCategorySpend,
    recentClaims,
    recentTravel,
    policies
  };
};

// ─── Get Manager Dashboard Metrics ────────────────────────────────────────────
export const getManagerDashboardMetrics = async (tenantContext, managerId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expenses = await Expense.find({ assignedManagerId: managerId }).lean();

  let pendingExpensesCount = 0;
  let approvedClaimsCount = 0;
  let totalReimbursedCount = 0;
  let totalReimbursedAmount = 0;
  let auditedExpenseCount = 0;
  let budgetUtilized = 0;
  const categorySpend = {};
  const pendingExpenses = [];

  for (const exp of expenses) {
    const status = (exp.status || '').trim().toLowerCase();
    
    if (['submitted', 'pending', 'under review'].includes(status)) {
      pendingExpensesCount++;
      pendingExpenses.push(exp);
    }
    
    if (['manager approved', 'finance approved'].includes(status)) {
      approvedClaimsCount++;
    }
    
    if (['audited', 'audit failed', 'flagged'].includes(status)) {
      auditedExpenseCount++;
    }
    
    let isPaid = false;
    if (['paid', 'audited', 'audit failed', 'flagged'].includes(status)) {
      isPaid = true;
    } else if (exp.actionHistory && Array.isArray(exp.actionHistory)) {
      isPaid = exp.actionHistory.some(history => (history.status || '').trim().toLowerCase() === 'paid');
    }
    
    if (isPaid) {
      totalReimbursedCount++;
      totalReimbursedAmount += (exp.amount || 0);
    }

    if (['manager approved', 'finance approved', 'paid', 'audited'].includes(status) || isPaid) {
      budgetUtilized += (exp.amount || 0);
      categorySpend[exp.category] = (categorySpend[exp.category] || 0) + (exp.amount || 0);
    }
  }

  return {
    totalClaims: expenses.length,
    pendingExpensesCount,
    approvedClaimsCount,
    totalReimbursedCount,
    totalReimbursedAmount,
    auditedExpenseCount,
    budgetUtilized,
    categorySpend,
    pendingExpenses: pendingExpenses
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .slice(0, 5) // Return top 5 pending
  };
};

// ─── Get Finance Dashboard Metrics ────────────────────────────────────────────
export const getFinanceDashboardMetrics = async (tenantContext) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expenses = await Expense.find({}).lean();

  let totalDisbursedAmount = 0;
  let claimsPaid = 0;

  let awaitingPayoutAmount = 0;
  let approvedClaims = 0;

  let policyViolationsCount = 0;
  let flaggedAmount = 0;

  let totalSubmittedAmount = 0;

  let pendingApprovalCount = 0;
  let rejectedClaimsCount = 0;

  const activeClaimantsSet = new Set();

  for (const exp of expenses) {
    totalSubmittedAmount += (exp.amount || 0);
    if (exp.employeeId) activeClaimantsSet.add(exp.employeeId.toString());

    if (exp.status === 'Paid') {
      totalDisbursedAmount += (exp.amount || 0);
      claimsPaid++;
    }

    if (exp.status === 'Finance Approved') {
      awaitingPayoutAmount += (exp.amount || 0);
      approvedClaims++;
    }

    if (exp.status === 'Audit Failed' || exp.status === 'Under Review') {
      policyViolationsCount++;
      flaggedAmount += (exp.amount || 0);
    }

    if (exp.status === 'Submitted' || exp.status === 'Manager Approved') {
      pendingApprovalCount++;
    }

    if (exp.status === 'Manager Rejected' || exp.status === 'Finance Rejected') {
      rejectedClaimsCount++;
    }
  }

  const averageClaimSize = expenses.length > 0 ? (totalSubmittedAmount / expenses.length) : 0;

  return {
    totalDisbursed: { amount: totalDisbursedAmount, claimsPaid },
    awaitingPayout: { amount: awaitingPayoutAmount, approvedClaims },
    policyViolations: { count: policyViolationsCount, flaggedAmount },
    totalClaims: { count: expenses.length, submittedAmount: totalSubmittedAmount },
    averageClaimSize: Math.round(averageClaimSize),
    pendingApproval: { count: pendingApprovalCount },
    rejectedClaims: { count: rejectedClaimsCount },
    activeClaimants: { count: activeClaimantsSet.size }
  };
};

// ─── Get Auditor Dashboard Metrics ────────────────────────────────────────────
export const getAuditorDashboardMetrics = async (tenantContext) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expenses = await Expense.find({}).lean();

  let ledgerClaimsCount = expenses.length;
  const activeClaimantsSet = new Set();

  let violationCount = 0;
  let flaggedCount = 0;
  let flaggedAmount = 0;

  let auditClearedCount = 0;

  let awaitingAuditCount = 0;
  let awaitingAuditAmount = 0;

  let policyViolationsCount = 0; // mapped from rejected/flagged

  let totalDisbursedAmount = 0;
  let totalReimbursedCount = 0;
  const categorySpend = {};

  for (const exp of expenses) {
    if (exp.employeeId) activeClaimantsSet.add(exp.employeeId.toString());

    if (exp.status === 'Audit Failed' || exp.status === 'Flagged') {
      flaggedCount++;
      flaggedAmount += (exp.amount || 0);
      violationCount++;
      policyViolationsCount++;
    } else if (exp.status === 'Manager Rejected' || exp.status === 'Finance Rejected' || exp.status === 'Under Review') {
      violationCount++;
      policyViolationsCount++;
    }

    if (exp.status === 'Audited') {
      auditClearedCount++;
      totalDisbursedAmount += (exp.amount || 0);
      totalReimbursedCount++;
    }

    if (exp.status === 'Paid') {
      awaitingAuditCount++;
      awaitingAuditAmount += (exp.amount || 0);
      totalDisbursedAmount += (exp.amount || 0);
      totalReimbursedCount++;
    }

    // Add flagged claims to total disbursed since they were paid out before auditing
    if (exp.status === 'Audit Failed' || exp.status === 'Flagged') {
      totalDisbursedAmount += (exp.amount || 0);
      totalReimbursedCount++;
    }

    // Category Spend
    if (exp.category) {
      categorySpend[exp.category] = (categorySpend[exp.category] || 0) + (exp.amount || 0);
    }
  }

  const complianceRate = ledgerClaimsCount > 0
    ? Math.round(((ledgerClaimsCount - violationCount) / ledgerClaimsCount) * 100)
    : 100;

  return {
    ledgerClaims: { count: ledgerClaimsCount, activeClaimants: activeClaimantsSet.size },
    complianceRate: { percentage: complianceRate, violationsFound: violationCount },
    flaggedClaims: { count: flaggedCount, underProbeAmount: flaggedAmount },
    auditCleared: { count: auditClearedCount },
    awaitingAudit: { count: awaitingAuditCount, amountToReview: awaitingAuditAmount },
    policyViolations: { count: policyViolationsCount },
    totalDisbursed: { amount: totalDisbursedAmount },
    totalReimbursedCount,
    categorySpend
  };
};

// ─── Get Admin Dashboard Metrics ────────────────────────────────────────────────
export const getAdminDashboardMetrics = async (tenantContext) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expenses = await Expense.find({}).lean();

  let pendingClaimsCount = 0;
  let totalSpendAmount = 0;
  let reimbursementsPendingCount = 0;
  let policyViolationsCount = 0;

  const categoryData = {};
  const monthlyData = {};
  const statusData = {};
  const employeeSpend = {};

  for (const exp of expenses) {
    const amount = exp.amount || 0;

    // Status counts
    statusData[exp.status] = (statusData[exp.status] || 0) + 1;

    // Categories
    categoryData[exp.category] = (categoryData[exp.category] || 0) + amount;

    // Monthly
    const dateToUse = exp.date || exp.createdAt || new Date();
    const month = new Date(dateToUse).toLocaleString('default', { month: 'short' });
    monthlyData[month] = (monthlyData[month] || 0) + amount;

    // Employee Spend
    const empId = exp.employeeId.toString();
    employeeSpend[empId] = (employeeSpend[empId] || 0) + amount;

    // Pending Claims
    if (['Draft', 'Pending', 'Submitted', 'Manager Approved', 'Under Review'].includes(exp.status)) {
      pendingClaimsCount++;
    }

    // Total Spend (Paid or moving towards paid)
    if (['Approved', 'Paid', 'Audit Cleared', 'Audit Failed', 'Flagged'].includes(exp.status)) {
      totalSpendAmount += amount;
    }

    // Reimbursements Pending (Finance Approved)
    if (exp.status === 'Approved') {
      reimbursementsPendingCount++;
    }

    // Policy Violations
    if (['Flagged', 'Audit Failed', 'Under Review'].includes(exp.status)) {
      policyViolationsCount++;
    }
  }

  let employeeMap = {};
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4300';
    const res = await axios.get(`${userServiceUrl}/api/v1/users/tenant/${tenantContext.slug}/employees`, {
      headers: {
        'x-tenant-id': tenantContext.id || '',
        'x-tenant-slug': tenantContext.slug || '',
        'x-tenant-db': tenantContext.dbName || ''
      }
    });
    if (res.data && res.data.success) {
      for (const emp of res.data.data) {
        employeeMap[emp._id || emp.id] = emp;
      }
    }
  } catch (err) {
    console.error('Failed to fetch employees for dashboard metrics:', err.message);
  }

  // Top Expenses
  const topExpenses = [...expenses]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5)
    .map(e => {
      const empIdStr = e.employeeId ? e.employeeId.toString() : '';
      const emp = employeeMap[empIdStr] || {};
      return {
        ...e,
        employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName}` : (emp.name || 'Unknown'),
        employeeRole: emp.role || 'Employee'
      };
    });

  // Pending Approvals
  const pendingApprovals = expenses
    .filter(e => ['Pending', 'Submitted', 'Manager Approved', 'Under Review'].includes(e.status))
    .sort((a, b) => new Date(b.createdAt || new Date()) - new Date(a.createdAt || new Date()))
    .slice(0, 5)
    .map(e => {
      const empIdStr = e.employeeId ? e.employeeId.toString() : '';
      const emp = employeeMap[empIdStr] || {};
      return {
        type: 'Expense Claim',
        id: e._id,
        employeeId: e.employeeId,
        employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName}` : (emp.name || 'Unknown'),
        submittedOn: e.date || e.createdAt,
        amount: e.amount
      };
    });

  return {
    pendingClaims: pendingClaimsCount,
    totalSpend: totalSpendAmount,
    reimbursementsPending: reimbursementsPendingCount,
    policyViolations: policyViolationsCount,
    categoryData,
    monthlyData,
    statusData,
    employeeSpend,
    topExpenses,
    pendingApprovals
  };
};

export const getDashboardStats = async (authHeader) => {
  let totalSpend = 0;
  let totalClaims = 0;
  let pendingClaims = 0;
  let approvedClaims = 0;
  let flaggedClaims = 0;
  const categorySpend = {};

  try {
    const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://localhost:4000';
    const config = authHeader ? { headers: { Authorization: authHeader } } : {};

    // Fetch all active tenants
    const res = await axios.get(`${tenantServiceUrl}/api/v1/tenants`, config);

    if (res.data && res.data.success && res.data.data) {
      const tenants = res.data.data;

      for (const tenant of tenants) {
        if (!tenant.dbName) continue;

        try {
          const Expense = getTenantModel(tenant.dbName, 'Expense', expenseSchema);
          const expenses = await Expense.find({}).lean();

          for (const exp of expenses) {
            totalClaims++;
            const amount = exp.amount || 0;

            if (['Pending', 'Submitted', 'Manager Approved', 'Under Review'].includes(exp.status)) {
              pendingClaims++;
            }
            if (['Approved', 'Finance Approved'].includes(exp.status)) {
              approvedClaims++;
            }
            if (['Flagged', 'Audit Failed', 'Under Review'].includes(exp.status)) {
              flaggedClaims++;
            }
            if (['Approved', 'Paid', 'Audit Cleared', 'Audit Failed', 'Flagged'].includes(exp.status)) {
              totalSpend += amount;
              categorySpend[exp.category] = (categorySpend[exp.category] || 0) + amount;
            }
          }
        } catch (dbErr) {
          console.error(`Failed to aggregate stats for tenant DB: ${tenant.dbName}`, dbErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch tenants for global dashboard stats:', err.message);
  }

  return {
    totalSpend,
    totalClaims,
    pendingClaims,
    approvedClaims,
    flaggedClaims,
    categorySpend
  };
};
