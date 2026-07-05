import Joi from 'joi';

// ─── Profile sub-schemas ───────────────────────────────────────────────────
const employeeProfileSchema = Joi.object({
  reportingManager: Joi.string().hex().length(24).optional().allow('', null),
  expenseLimit: Joi.number().min(0).optional(),
  costCenter: Joi.string().optional().allow('', null),
  employmentType: Joi.string().valid('full-time', 'part-time', 'contract', 'intern').optional(),
  officeLocation: Joi.string().optional().allow('', null),
  panNumber: Joi.string().optional().allow('', null),
  bankAccountNumber: Joi.string().optional().allow('', null),
  ifscCode: Joi.string().optional().allow('', null),
});

const managerProfileSchema = Joi.object({
  team: Joi.array().items(Joi.string().hex().length(24)).optional(),
  approvalLimit: Joi.number().min(0).optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

const financeProfileSchema = Joi.object({
  financeRole: Joi.string().valid('accountant', 'controller', 'analyst', 'other').optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

const auditorProfileSchema = Joi.object({
  auditType: Joi.string().valid('internal', 'external', 'compliance', 'other').optional(),
  auditRegion: Joi.string().optional().allow('', null),
  permissions: Joi.array().items(Joi.string()).optional(),
});

// ─── Create Employee ───────────────────────────────────────────────────────
export const createEmployeeSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  employeeId: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().pattern(/^\+?[0-9\s\-().]{7,20}$/).optional().allow('', null),
  profilePhoto: Joi.string().uri().optional().allow('', null),
  department: Joi.string().required(),
  designation: Joi.string().required(),
  joiningDate: Joi.date().iso().optional().allow(null),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  role: Joi.string().valid('employee', 'manager', 'finance', 'auditor', 'admin').required(),
  // role-specific profile (optional block)
  profile: Joi.when('role', {
    switch: [
      { is: 'employee', then: employeeProfileSchema },
      { is: 'manager',  then: managerProfileSchema  },
      { is: 'finance',  then: financeProfileSchema   },
      { is: 'auditor',  then: auditorProfileSchema   },
    ],
    otherwise: Joi.object().optional(),
  }),
});

// ─── Update Employee ───────────────────────────────────────────────────────
export const updateEmployeeSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  phone: Joi.string().pattern(/^\+?[0-9\s\-().]{7,20}$/).optional().allow('', null),
  department: Joi.string().optional(),
  designation: Joi.string().optional(),
  joiningDate: Joi.date().iso().optional().allow(null),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  role: Joi.string().valid('employee', 'manager', 'finance', 'auditor', 'admin').optional(),
  profilePhoto: Joi.string().uri().optional().allow('', null),
});

// ─── Assign Manager ────────────────────────────────────────────────────────
export const assignManagerSchema = Joi.object({
  managerId: Joi.string().hex().length(24).optional().allow(null),
});
