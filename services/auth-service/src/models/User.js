import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  tenantId: { type: String, required: false, index: true },
  tenantSlug: { type: String, required: false, index: true, default: null },
  role: { type: String, required: true, enum: ['super_admin', 'company_admin', 'manager', 'finance', 'auditor', 'employee'] },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: false },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  refreshToken: { type: String, default: null },
  passwordResetToken: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('AuthUser', userSchema);
