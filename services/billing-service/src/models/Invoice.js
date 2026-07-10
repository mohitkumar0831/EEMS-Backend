import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    tenantId: { type: String, required: true, index: true },
    tenantSlug: { type: String, required: true },

    // Invoice details
    invoiceNumber: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    planName: { type: String, required: true },
    billingCycle: { type: String, required: true },

    // Amounts
    subtotal: { type: Number, required: true },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    // Billing period
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },

    // PDF storage
    pdfUrl: { type: String, default: null },

    // Status
    status: {
      type: String,
      enum: ['Draft', 'Issued', 'Paid', 'Void'],
      default: 'Draft',
    },

    issuedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
