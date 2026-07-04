import { getTenantModel } from '../config/db.js';
import { expenseSchema } from '../models/Expense.js';
import { receiptSchema } from '../models/Receipt.js';
import { processReceipt } from '../utils/ocr.js';
import { parseReceiptText } from '../utils/receiptParser.js';

// ─── Upload & OCR Receipt ───────────────────────────────────────────────────
export const uploadAndScanReceipt = async (tenantContext, file, employeeId) => {
  const { dbName, id: tenantId } = tenantContext;
  const Receipt = getTenantModel(dbName, 'Receipt', receiptSchema);

  // 1. Create receipt record with status = processing
  const receipt = await Receipt.create({
    originalName: file.originalname,
    fileName: file.filename,
    filePath: file.path,
    mimeType: file.mimetype,
    fileSize: file.size,
    employeeId,
    tenantId,
    ocrStatus: 'processing',
  });

  // 2. Run OCR (async but we await it here)
  try {
    const { text, confidence } = await processReceipt(file.path, file.mimetype);
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

  return Expense.find({ employeeId }).sort({ createdAt: -1 });
};

// ─── Get Expenses for Manager Approval ──────────────────────────────────────
export const getExpensesForManager = async (tenantContext, managerId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  return Expense.find({
    assignedManagerId: managerId,
    status: 'Submitted',
  }).sort({ createdAt: -1 });
};

// ─── Get Single Expense ─────────────────────────────────────────────────────
export const getExpenseById = async (tenantContext, expenseId) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }
  return expense;
};

// ─── Update Expense Status (Manager/Finance/Auditor approvals) ──────────────
export const updateExpenseStatus = async (tenantContext, expenseId, statusData) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const expense = await Expense.findById(expenseId);
  if (!expense) {
    throw { status: 404, message: 'Expense not found' };
  }

  expense.status = statusData.status;
  await expense.save();

  return expense;
};

// ─── Get All Expenses (admin/finance view) ──────────────────────────────────
export const getAllExpenses = async (tenantContext, filters = {}) => {
  const { dbName } = tenantContext;
  const Expense = getTenantModel(dbName, 'Expense', expenseSchema);

  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.category) query.category = filters.category;

  return Expense.find(query).sort({ createdAt: -1 });
};
