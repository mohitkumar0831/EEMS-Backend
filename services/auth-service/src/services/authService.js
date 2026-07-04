import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { sendNotificationEvent } from '../utils/events.js';

const signToken = (payload, secret, expiresIn) => jwt.sign(payload, secret, { expiresIn });

/**
 * Called by the tenant listener when a new tenant is registered.
 * Creates a company_admin user in the auth DB with the tenant's hashed temp password.
 */
export const createCompanyAdmin = async ({ tenantId, tenantSlug, adminEmail, adminName, tempPassword }) => {
  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    // eslint-disable-next-line no-console
    console.warn(`[Auth] company_admin for ${adminEmail} already exists — skipping.`);
    return;
  }
  const hashedPassword = await hashPassword(tempPassword);
  await User.create({
    name: adminName,
    email: adminEmail,
    password: hashedPassword,
    role: 'company_admin',
    tenantId,
    tenantSlug,
    emailVerified: true,
    isActive: true,
  });
  // eslint-disable-next-line no-console
  console.log(`[Auth] company_admin created for tenant "${tenantSlug}" (${adminEmail})`);
};

/**
 * Called by the tenant listener when a new employee is registered.
 * Creates an auth user with the employee's role and the provided password.
 */
export const createEmployeeUser = async ({ tenantId, tenantSlug, employeeId, email, name, role, password }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    // eslint-disable-next-line no-console
    console.warn(`[Auth] User for ${email} already exists — skipping.`);
    return;
  }
  
  // Use the password passed from the user-service
  const hashedPassword = await hashPassword(password);
  
  await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    tenantId,
    tenantSlug,
    emailVerified: true,
    isActive: true,
  });
  
  // Notify notification-service to send the employee welcome email with password
  await sendNotificationEvent('notification.employee_welcome', {
    email,
    name,
    role,
    tenantSlug,
    tempPassword: password, // The user requested to send this password in the email
  });
  
  // eslint-disable-next-line no-console
  console.log(`[Auth] ${role} created for tenant "${tenantSlug}" (${email})`);
};

/**
 * Tenant-specific login. Validates that the user belongs to the given tenant slug.
 */
export const tenantLogin = async (slug, { email, password }) => {
  // Find user by email + tenant slug
  const user = await User.findOne({ email, tenantSlug: slug, isDeleted: false });
  if (!user || !user.isActive) {
    throw { status: 401, message: 'Invalid credentials or tenant not found' };
  }
  if (user.role !== 'company_admin' && user.role !== 'manager' && user.role !== 'finance' && user.role !== 'auditor' && user.role !== 'employee') {
    throw { status: 403, message: 'Access denied for this tenant' };
  }
  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw { status: 401, message: 'Invalid credentials or tenant not found' };
  }
  const accessToken = signToken(
    { userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug },
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES
  );
  const refreshToken = signToken(
    { userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug },
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES
  );
  user.refreshToken = refreshToken;
  await user.save();
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
    },
  };
};

export const registerSuperAdmin = async ({ name, email, password }) => {
  const existing = await User.findOne({ role: 'super_admin', isDeleted: false });
  if (existing) {
    throw { status: 400, message: 'Super Admin account already exists' };
  }
  const hashedPassword = await hashPassword(password);
  const user = await User.create({ name, email, password: hashedPassword, role: 'super_admin', emailVerified: true });
  const accessToken = signToken({ userId: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, process.env.JWT_ACCESS_EXPIRES);
  const refreshToken = signToken({ userId: user._id, role: user.role }, process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES);
  user.refreshToken = refreshToken;
  await user.save();
  return { accessToken, refreshToken, user: { id: user._id, email: user.email, role: user.role } };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user || !user.isActive) {
    throw { status: 401, message: 'Invalid credentials' };
  }
  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw { status: 401, message: 'Invalid credentials' };
  }
  const accessToken = signToken({ userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug }, process.env.JWT_ACCESS_SECRET, process.env.JWT_ACCESS_EXPIRES);
  const refreshToken = signToken({ userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug }, process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES);
  user.refreshToken = refreshToken;
  await user.save();
  return { accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug } };
};

export const refreshToken = async ({ refreshToken }) => {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findOne({ _id: decoded.userId, refreshToken, isDeleted: false });
  if (!user) {
    throw { status: 401, message: 'Invalid refresh token' };
  }
  const accessToken = signToken({ userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug }, process.env.JWT_ACCESS_SECRET, process.env.JWT_ACCESS_EXPIRES);
  const newRefreshToken = signToken({ userId: user._id, role: user.role, tenantId: user.tenantId, tenantSlug: user.tenantSlug }, process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES);
  user.refreshToken = newRefreshToken;
  await user.save();
  return { accessToken, refreshToken: newRefreshToken };
};

export const requestPasswordReset = async ({ email }) => {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = Date.now() + 3600000;
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = resetTokenExpiry;
  await user.save();
  await sendNotificationEvent('notification.password_reset', { email: user.email, resetToken, name: user.name });
  return { message: 'Password reset initiated' };
};

export const resetPassword = async ({ token, password }) => {
  const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() }, isDeleted: false });
  if (!user) {
    throw { status: 400, message: 'Invalid password reset token' };
  }
  user.password = await hashPassword(password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();
  return { message: 'Password reset successfully' };
};

export const changePassword = async ({ userId, oldPassword, newPassword }) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  const valid = await comparePassword(oldPassword, user.password);
  if (!valid) {
    throw { status: 400, message: 'Current password does not match' };
  }
  user.password = await hashPassword(newPassword);
  await user.save();
  return { message: 'Password changed successfully' };
};
