import Joi from 'joi';

export const createExpenseSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  category: Joi.string()
    .valid('Meals', 'Travel', 'Equipment', 'Accommodation', 'Office Supplies', 'Communication', 'Other')
    .required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().max(1000).optional().allow('', null),
  employeeId: Joi.string().hex().length(24).required(),
  assignedManagerId: Joi.string().hex().length(24).optional().allow('', null),
  receiptId: Joi.string().hex().length(24).optional().allow('', null),
  policyId: Joi.string().hex().length(24).optional().allow('', null),
  status: Joi.string()
    .valid('Draft', 'Submitted')
    .optional()
    .default('Submitted'),
});

export const updateExpenseStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      'Manager Approved',
      'Manager Rejected',
      'Finance Approved',
      'Finance Rejected',
      'Paid',
      'Audited',
      'Audit Failed'
    )
    .required(),
  remarks: Joi.string().max(500).optional().allow('', null),
  actionBy: Joi.string().hex().length(24).required(),
});

export const processPayoutSchema = Joi.object({
  actionBy: Joi.string().hex().length(24).required(),
  payoutRoute: Joi.string()
    .valid('ACH Direct Deposit', 'Wire Transfer', 'Corporate Credit Card', 'Check Clearance')
    .required(),
  paymentReference: Joi.string().max(100).optional().allow('', null),
});
