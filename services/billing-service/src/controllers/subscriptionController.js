import * as subscriptionService from '../services/subscriptionService.js';
import { successResponse, errorResponse } from '../responses/apiResponse.js';

export const createSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionService.createSubscription({
      ...req.body,
      createdBy: req.user?.userId,
    });
    return successResponse({ res, message: 'Subscription created', data: subscription, status: 201 });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getSubscriptionByTenantId = async (req, res) => {
  try {
    const subscription = await subscriptionService.getSubscriptionByTenantId(req.params.tenantId);
    return successResponse({ res, message: 'Subscription retrieved', data: subscription });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const changePlan = async (req, res) => {
  try {
    const result = await subscriptionService.changePlan(
      req.params.id,
      req.body.planId,
      req.body.billingCycle
    );
    return successResponse({ res, message: 'Plan change processed', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const overrideSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionService.overrideSubscription(req.params.id, req.body);
    return successResponse({ res, message: 'Subscription overridden', data: subscription });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await subscriptionService.getAllSubscriptions();
    return successResponse({ res, message: 'All subscriptions retrieved', data: subscriptions });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getBillingStats = async (req, res) => {
  try {
    const stats = await subscriptionService.getBillingStats();
    return successResponse({ res, message: 'Billing stats retrieved', data: stats });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};
