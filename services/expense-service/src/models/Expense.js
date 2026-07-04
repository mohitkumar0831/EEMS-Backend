import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Meals', 'Travel', 'Equipment', 'Accommodation', 'Office Supplies', 'Communication', 'Other'],
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },

    // ─── References ─────────────────────────────────────────────
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    assignedManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Receipt',
      default: null,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpensePolicy',
      default: null,
    },

    // ─── Status ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'Draft',
        'Submitted',
        'Manager Approved',
        'Manager Rejected',
        'Finance Approved',
        'Finance Rejected',
        'Paid',
        'Audited',
        'Audit Failed',
      ],
      default: 'Submitted',
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for fast queries by employee + status
expenseSchema.index({ employeeId: 1, status: 1 });
expenseSchema.index({ assignedManagerId: 1, status: 1 });
expenseSchema.index({ tenantId: 1 });

export { expenseSchema };
