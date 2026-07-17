import * as paymentService from '../services/paymentService.js';
import * as invoiceService from '../services/invoiceService.js';
import { successResponse, errorResponse } from '../responses/apiResponse.js';

export const createOrder = async (req, res) => {
  try {
    const order = await paymentService.createOrder(req.body);
    return successResponse({ res, message: 'Razorpay order created', data: order, status: 201 });
  } catch (error) {
    console.error('Error in createOrder:', error);
    const msg = error.error?.description || error.message || 'Internal server error';
    return errorResponse({ res, message: msg, status: error.statusCode || error.status || 500 });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const result = await paymentService.verifyPayment(req.body);
    return successResponse({ res, message: 'Payment verified and subscription activated', data: result });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    const msg = error.error?.description || error.message || 'Internal server error';
    return errorResponse({ res, message: msg, status: error.statusCode || error.status || 500 });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await paymentService.getPaymentHistory(req.params.tenantId);
    return successResponse({ res, message: 'Payment history retrieved', data: payments });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments(req.query);
    return successResponse({ res, message: 'All payments retrieved', data: payments });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const invoices = await invoiceService.getInvoicesByTenantId(req.params.tenantId);
    return successResponse({ res, message: 'Invoices retrieved', data: invoices });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const downloadInvoice = async (req, res) => {
  try {
    const { buffer, invoice } = await invoiceService.generateInvoicePdf(req.params.invoiceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getMonthlyVolume = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;
    const result = await paymentService.getMonthlyVolume(year, month);
    return successResponse({ res, message: 'Monthly payment volume retrieved', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};
