import mongoose from 'mongoose';

// ─────────────────────────────────────────────
// User Schema
// ─────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: null, trim: true },
    profilePhoto: { type: String, default: null },          // URL / file path
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    joiningDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ['employee', 'manager', 'finance', 'auditor', 'admin'],
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// EmployeeProfile Schema
// ─────────────────────────────────────────────
const employeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    costCenter: { type: String, default: null, trim: true },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    officeLocation: { type: String, default: null, trim: true },
    panNumber: { type: String, default: null, trim: true },
    bankAccountNumber: { type: String, default: null, trim: true },
    ifscCode: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// ManagerProfile Schema
// ─────────────────────────────────────────────
const managerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    team: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    approvalLimit: { type: Number, default: 0 },
    permissions: { type: [String], default: [] },   // e.g. ['approve_expense', 'view_reports']
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// FinanceProfile Schema
// ─────────────────────────────────────────────
const financeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    financeRole: {
      type: String,
      enum: ['accountant', 'controller', 'analyst', 'other'],
      default: 'accountant',
    },
    permissions: { type: [String], default: [] },     // e.g. ['process_payment', 'view_budget']
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// AuditorProfile Schema
// ─────────────────────────────────────────────
const auditorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    auditType: {
      type: String,
      enum: ['internal', 'external', 'compliance', 'other'],
      default: 'internal',
    },
    auditRegion: { type: String, default: null, trim: true },
    permissions: { type: [String], default: [] },    // e.g. ['view_all_expenses', 'generate_audit_report']
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Schema exports (used by getTenantModel)
// ─────────────────────────────────────────────
export {
  userSchema,
  employeeProfileSchema,
  managerProfileSchema,
  financeProfileSchema,
  auditorProfileSchema,
};

// ─────────────────────────────────────────────
// Compiled Models (for direct use if needed)
// ─────────────────────────────────────────────
export const User = mongoose.model('User', userSchema);
export const EmployeeProfile = mongoose.model('EmployeeProfile', employeeProfileSchema);
export const ManagerProfile = mongoose.model('ManagerProfile', managerProfileSchema);
export const FinanceProfile = mongoose.model('FinanceProfile', financeProfileSchema);
export const AuditorProfile = mongoose.model('AuditorProfile', auditorProfileSchema);
