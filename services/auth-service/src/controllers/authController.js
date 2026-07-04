import * as authService from '../services/authService.js';
import { successResponse, errorResponse } from '../responses/apiResponse.js';

export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return successResponse({ res, message: 'Login successful', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const tenantLogin = async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await authService.tenantLogin(slug, req.body);
    return successResponse({ res, message: `Login successful — welcome to ${slug}`, data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const result = await authService.refreshToken(req.body);
    return successResponse({ res, message: 'Token refreshed', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const result = await authService.requestPasswordReset(req.body);
    return successResponse({ res, message: result.message, data: null });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    return successResponse({ res, message: result.message, data: null });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const changePassword = async (req, res) => {
  try {
    const payload = { userId: req.user.userId, ...req.body };
    const result = await authService.changePassword(payload);
    return successResponse({ res, message: result.message, data: null });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};

export const registerSuperAdmin = async (req, res) => {
  try {
    const result = await authService.registerSuperAdmin(req.body);
    return successResponse({ res, message: 'Super Admin created successfully', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors, status: error.status || 500 });
  }
};
