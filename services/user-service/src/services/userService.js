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
  const EmployeeProfile = getTenantModel(dbName, 'EmployeeProfile', employeeProfileSchema);

  const users = await User.find({ status: { $ne: 'inactive' } })
    .select('-password')
    .sort({ createdAt: -1 })
    .lean();

  const employeeProfiles = await EmployeeProfile.find({}).lean();
  const profileMap = {};
  employeeProfiles.forEach(p => {
    profileMap[p.userId.toString()] = p;
  });

  return users.map(u => {
    const profile = profileMap[u._id.toString()];
    if (profile) {
      return { ...u, reportingManager: profile.reportingManager };
    }
    return u;
  });
};

// ─── Get Employees by Manager ───────────────────────────────────────────────
export const getEmployeesByManager = async (tenantContext, managerId) => {
  const { dbName } = tenantContext;
  
  const EmployeeProfile = getTenantModel(dbName, 'EmployeeProfile', employeeProfileSchema);
  getTenantModel(dbName, 'User', userSchema);

  const profiles = await EmployeeProfile.find({ reportingManager: managerId }).populate('userId');
  
  return profiles.map(profile => {
    if (profile.userId) {
      const user = profile.userId.toObject();
      delete user.password;
      return user;
    }
    return null;
  }).filter(Boolean);
};

// ─── Assign Manager ─────────────────────────────────────────────────────────
export const assignManager = async (tenantContext, employeeId, managerId) => {
  const { dbName } = tenantContext;
  
  const EmployeeProfile = getTenantModel(dbName, 'EmployeeProfile', employeeProfileSchema);
  const ManagerProfile = getTenantModel(dbName, 'ManagerProfile', managerProfileSchema);

  // 1. Find the employee profile
  const employeeProfile = await EmployeeProfile.findOne({ userId: employeeId });
  if (!employeeProfile) {
    throw { status: 404, message: 'Employee profile not found' };
  }

  const previousManagerId = employeeProfile.reportingManager;

  // 2. If assigning to a new manager, update the new manager's team
  if (managerId) {
    const newManagerProfile = await ManagerProfile.findOne({ userId: managerId });
    if (!newManagerProfile) {
      throw { status: 404, message: 'Manager profile not found' };
    }
    
    // Add employee to new manager's team if not already there
    if (!newManagerProfile.team.includes(employeeId)) {
      newManagerProfile.team.push(employeeId);
      await newManagerProfile.save();
    }
  }

  // 3. If there was a previous manager and it's different from the new one, remove employee from old manager's team
  if (previousManagerId && previousManagerId.toString() !== (managerId || '').toString()) {
    const oldManagerProfile = await ManagerProfile.findOne({ userId: previousManagerId });
    if (oldManagerProfile) {
      oldManagerProfile.team = oldManagerProfile.team.filter(id => id.toString() !== employeeId.toString());
      await oldManagerProfile.save();
    }
  }

  // 4. Update the employee's reporting manager
  employeeProfile.reportingManager = managerId || null;
  await employeeProfile.save();

  return employeeProfile;
};
