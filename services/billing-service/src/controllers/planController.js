import * as planService from '../services/planService.js';
import { successResponse, errorResponse } from '../responses/apiResponse.js';

export const createPlan = async (req, res) => {
  try {
    const plan = await planService.createPlan(req.body);
    return successResponse({ res, message: 'Subscription plan created', data: plan, status: 201 });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getAllPlans = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const plans = await planService.getAllPlans(includeInactive);
    return successResponse({ res, message: 'Plans retrieved', data: plans });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const plan = await planService.getPlanById(req.params.planId);
    return successResponse({ res, message: 'Plan retrieved', data: plan });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await planService.updatePlan(req.params.planId, req.body);
    return successResponse({ res, message: 'Plan updated', data: plan });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};

export const deactivatePlan = async (req, res) => {
  try {
    const plan = await planService.deactivatePlan(req.params.planId);
    return successResponse({ res, message: 'Plan deactivated', data: plan });
  } catch (error) {
    return errorResponse({ res, message: error.message, status: error.status || 500 });
  }
};
