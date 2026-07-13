import express from 'express';
import { authenticate, authorize } from '../middlewares/authenticate.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createPlanSchema, updatePlanSchema,
  createSubscriptionSchema, upgradeSubscriptionSchema, overrideSubscriptionSchema,
  createOrderSchema, verifyPaymentSchema,
} from '../validators/billingValidator.js';
import * as planController from '../controllers/planController.js';
import * as subscriptionController from '../controllers/subscriptionController.js';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

// ─── Health Check ──────────────────────────────────
router.get('/health', (req, res) => res.json({ success: true, message: 'Billing service healthy' }));

// ─── Plan Routes (SuperAdmin) ──────────────────────
router.post('/plans', authenticate, authorize('super_admin'), validateRequest(createPlanSchema), planController.createPlan);
router.get('/plans', planController.getAllPlans); // Public — tenants need to see available plans
router.get('/plans/:planId', planController.getPlanById);
router.put('/plans/:planId', authenticate, authorize('super_admin'), validateRequest(updatePlanSchema), planController.updatePlan);
router.delete('/plans/:planId', authenticate, authorize('super_admin'), planController.deactivatePlan);

// ─── Subscription Routes ───────────────────────────
router.post('/subscriptions', authenticate, authorize('super_admin'), validateRequest(createSubscriptionSchema), subscriptionController.createSubscription);
router.get('/subscriptions', authenticate, authorize('super_admin'), subscriptionController.getAllSubscriptions);
router.get('/subscriptions/stats', authenticate, authorize('super_admin'), subscriptionController.getBillingStats);
router.get('/subscriptions/:tenantId', authenticate, subscriptionController.getSubscriptionByTenantId);
router.patch('/subscriptions/:id/upgrade', authenticate, authorize('super_admin', 'company_admin'), validateRequest(upgradeSubscriptionSchema), subscriptionController.changePlan);
router.patch('/subscriptions/:id/override', authenticate, authorize('super_admin'), validateRequest(overrideSubscriptionSchema), subscriptionController.overrideSubscription);

// ─── Payment Routes ────────────────────────────────
router.post('/payments/create-order', authenticate, authorize('company_admin'), validateRequest(createOrderSchema), paymentController.createOrder);
router.post('/payments/verify', authenticate, authorize('company_admin'), paymentController.verifyPayment);
router.get('/payments', authenticate, authorize('super_admin'), paymentController.getAllPayments);
router.get('/payments/monthly-volume', authenticate, authorize('super_admin'), paymentController.getMonthlyVolume);
router.get('/payments/tenant/:tenantId', authenticate, paymentController.getPaymentHistory);

// ─── Invoice Routes ────────────────────────────────
router.get('/invoices/tenant/:tenantId', authenticate, paymentController.getInvoices);
router.get('/invoices/:invoiceId/download', authenticate, paymentController.downloadInvoice);

export default router;
