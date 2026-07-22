import Joi from 'joi';

export const registerTenantSchema = Joi.object({
  // Basic Company Information
  companyName: Joi.string().min(2).max(100).required(),
  companyCode: Joi.string().min(2).max(50).required(),
  industryType: Joi.string().valid('Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Other').required(),
  registrationNumber: Joi.string().optional().allow('', null),
  gstNumber: Joi.string().optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null),
  companyEmail: Joi.string().email().required(),
  companyPhone: Joi.string().pattern(/^\+?[0-9\s\-().]{7,20}$/).optional().allow('', null),

  // Company Capacity
  employeeCapacity: Joi.number().integer().min(0).optional().allow(null),
  branchCapacity: Joi.number().integer().min(0).optional().allow(null),
  storageLimitGb: Joi.number().min(0).optional().allow(null),
  monthlyExpenseLimit: Joi.number().min(0).optional().allow(null),

  // Subscription Details
  subscriptionPlan: Joi.string().valid('Trial', 'Basic', 'Standard', 'Enterprise').optional(),
  billingCycle: Joi.string().valid('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly').optional(),

  // Company Address
  address: Joi.object({
    line1: Joi.string().optional().allow('', null),
    line2: Joi.string().optional().allow('', null),
    city: Joi.string().optional().allow('', null),
    state: Joi.string().optional().allow('', null),
    country: Joi.string().valid('United States', 'United Kingdom', 'Canada', 'India', 'Australia', 'Other').optional(),
    postalCode: Joi.string().optional().allow('', null),
  }).optional(),

  // Admin Details
  adminName: Joi.string().min(2).max(100).required(),
  adminEmail: Joi.string().email().required(),
  adminPhone: Joi.string().pattern(/^\+?[0-9\s\-().]{7,20}$/).optional().allow('', null),

  // System Configuration
  config: Joi.object({
    timeZone: Joi.string().valid('UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata').optional(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'INR', 'AUD').optional(),
    dateFormat: Joi.string().valid('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD').optional(),
    language: Joi.string().valid('English', 'French', 'German', 'Spanish').optional(),

  }).optional(),

  // Status
  status: Joi.string().valid('Active', 'Inactive', 'Suspended').optional(),

});
