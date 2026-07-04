import bcrypt from 'bcrypt';
import { getTenantModel } from '../config/db.js';
import {
  userSchema,
  employeeProfileSchema,
  managerProfileSchema,
  financeProfileSchema,
  auditorProfileSchema,
} from '../models/Employee.js';
import { sendEvent } from '../utils/events.js';

// Map role → { modelName, schema }
const PROFILE_MAP = {
  employee: { modelName: 'EmployeeProfile', schema: employeeProfileSchema },
  manager:  { modelName: 'ManagerProfile',  schema: managerProfileSchema  },
  finance:  { modelName: 'FinanceProfile',  schema: financeProfileSchema  },
  auditor:  { modelName: 'AuditorProfile',  schema: auditorProfileSchema  },
};

const SALT_ROUNDS = 10;

// ─── Create Employee ────────────────────────────────────────────────────────
export const createEmployee = async (tenantContext, employeeData) => {
  const { dbName, slug, id: tenantId } = tenantContext;

  const User = getTenantModel(dbName, 'User', userSchema);

  // Check duplicate email
  const existing = await User.findOne({ email: employeeData.email });
  if (existing) {
    throw { status: 409, message: 'An employee with this email already exists' };
  }

  // Check duplicate employeeId
  const existingId = await User.findOne({ employeeId: employeeData.employeeId });
  if (existingId) {
    throw { status: 409, message: 'An employee with this employee ID already exists' };
  }

  // Separate profile data from core user data
  const { profile, password, ...restData } = employeeData;

  // Hash password before storing
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Save User with hashed password
  const user = await User.create({ ...restData, password: hashedPassword, tenantId });

  // Save role-specific profile sub-document (if profile data provided)
  let profileDoc = null;
  const profileConfig = PROFILE_MAP[user.role];
  if (profileConfig && profile) {
    const ProfileModel = getTenantModel(dbName, profileConfig.modelName, profileConfig.schema);
    profileDoc = await ProfileModel.create({ userId: user._id, ...profile });
  }

  // Emit event to auth-service and notification-service
  await sendEvent('employee.registered', {
    tenantId,
    tenantSlug: slug,
    employeeId: user._id.toString(),
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
    password,       // send plain password so auth-service can also store credentials
    dbName,
  });

  // Don't return the hashed password in the response
  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, profile: profileDoc };
};

// ─── Get All Employees ──────────────────────────────────────────────────────
export const getEmployees = async (tenantContext) => {
  const { dbName } = tenantContext;
  const User = getTenantModel(dbName, 'User', userSchema);
  return User.find({ status: { $ne: 'inactive' } })
    .select('-password')
    .sort({ createdAt: -1 });
};
