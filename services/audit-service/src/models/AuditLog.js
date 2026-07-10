import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      default: 'platform',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
    targetId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false } // We use custom timestamp
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
