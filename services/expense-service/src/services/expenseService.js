import { getTenantModel } from '../config/db.js';
import { expenseSchema } from '../models/Expense.js';
import { receiptSchema } from '../models/Receipt.js';
import { processReceipt } from '../utils/ocr.js';
import { parseReceiptText } from '../utils/receiptParser.js';
import { createOrder, verifySignature, generatePayoutReceipt } from './payoutService.js';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'receipts' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
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

  return expense;
};

// ─── Get All Expenses (for employee – their own) ────────────────────────────
export const getExpensesByEmployee = async (tenantContext, employeeId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  return Expense.find({ employeeId }).populate('receiptId').sort({ createdAt: -1 });
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

  return expense.populate('receiptId');
};

// ─── Get All Expenses (admin/finance view) ──────────────────────────────────
export const getAllExpenses = async (tenantContext, filters = {}) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);
  getTenantModel(dbName, 'Receipt', receiptSchema); // Ensure Receipt model is registered for populate

  const query = {};
  if (filters.status) query.status = filters.status;
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
  if (!['Manager Approved', 'Finance Approved'].includes(expense.status)) {
    throw { status: 400, message: 'Expense must be Manager Approved or Finance Approved before payout' };
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
