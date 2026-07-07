import * as tenantService from '../services/tenantService.js';
import { successResponse, errorResponse } from '../responses/apiResponse.js';

export const registerTenant = async (req, res) => {
  try {
    const result = await tenantService.registerTenant(req.body, req.user.userId);
    return successResponse({ res, message: 'Tenant company registered successfully', data: result, status: 201 });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const getAllTenants = async (req, res) => {
  try {
    const token = req.headers.authorization;
    const tenants = await tenantService.getAllTenants(token);
    return successResponse({ res, message: 'Tenants retrieved successfully', data: tenants });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const getTenantsSummary = async (req, res) => {
  try {
    const token = req.headers.authorization;
    const summary = await tenantService.getTenantsSummary(token);
    return successResponse({ res, message: 'Tenant summary retrieved successfully', data: summary });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const getCompanyAdmins = async (req, res) => {
  try {
    const admins = await tenantService.getCompanyAdmins();
    return successResponse({ res, message: 'Company admins retrieved successfully', data: admins });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const getTenantBySlug = async (req, res) => {
  try {
    const tenant = await tenantService.getTenantBySlug(req.params.slug);
    return successResponse({ res, message: 'Tenant retrieved successfully', data: tenant });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const updateTenantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await tenantService.updateTenantStatus(req.params.slug, status);
    return successResponse({ res, message: `Tenant status updated to ${status}`, data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const deleteTenant = async (req, res) => {
  try {
    const result = await tenantService.deleteTenant(req.params.slug);
    return successResponse({ res, message: 'Tenant successfully deleted', data: result });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};

export const validateTenant = async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const tenantSlug = req.headers['x-tenant-slug'];
    
    if (!tenantId && !tenantSlug) {
      return errorResponse({ res, message: 'Tenant ID or Slug is required', status: 400 });
    }
    
    const tenant = await tenantService.validateTenant(tenantId, tenantSlug);
    return successResponse({ res, message: 'Tenant validated successfully', data: tenant });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 401 });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const stats = await tenantService.getDashboardStats();
    return successResponse({ res, message: 'Tenant dashboard stats retrieved successfully', data: stats });
  } catch (error) {
    return errorResponse({ res, message: error.message, errors: error.errors || null, status: error.status || 500 });
  }
};
