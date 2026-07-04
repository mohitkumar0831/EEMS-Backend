import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema(
  {
    // ─── File Info ────────────────────────────────────────────────
    originalName: { type: String, required: true },
    fileName:     { type: String, required: true },       // stored filename (uuid)
    filePath:     { type: String, required: true },       // full path on disk
    mimeType:     { type: String, required: true },
    fileSize:     { type: Number, required: true },       // bytes

    // ─── References ───────────────────────────────────────────────
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

    // ─── OCR Processing ───────────────────────────────────────────
    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    rawText:   { type: String, default: null },           // full OCR output

    // ─── Extracted Data (parsed from OCR) ─────────────────────────
    extractedData: {
      vendor:       { type: String, default: null },
      amount:       { type: Number, default: null },
      currency:     { type: String, default: 'INR' },
      date:         { type: Date,   default: null },
      invoiceNumber:{ type: String, default: null },
      taxAmount:    { type: Number, default: null },
      items:        [{ description: String, amount: Number }],
    },

    ocrConfidence: { type: Number, default: null },       // 0–100
    ocrError:      { type: String, default: null },
  },
  { timestamps: true }
);

receiptSchema.index({ employeeId: 1 });
receiptSchema.index({ tenantId: 1 });

export { receiptSchema };
