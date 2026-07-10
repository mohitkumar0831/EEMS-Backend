import mongoose from 'mongoose';
import axios from 'axios';
import Tenant from '../models/Tenant.js';
import { generateSlug } from '../utils/slug.js';
import { generateTempPassword } from '../utils/password.js';
import { sendTenantRegisteredEvent, sendNotificationEvent, sendTenantDeletedEvent } from '../utils/events.js';

/**
 * Builds a Mongo URI for a specific database by replacing the DB segment
 * of the existing MONGO_URI.
 * e.g. mongodb://root:example@mongo:27017/ems-tenant?authSource=admin
 *   → mongodb://root:example@mongo:27017/ems-tenant-acme-corp?authSource=admin
 */
const buildTenantDbUri = (slug) => {
  const base = process.env.MONGO_URI;
  // Replace the database name (segment between last "/" and "?" or end-of-string)
  return base.replace(/(mongodb(?:\+srv)?:\/\/[^/]+\/)([^?]+)(\??.*)?$/, (_, prefix, _db, query) => {
    return `${prefix}ems-tenant-${slug}${query || ''}`;
  });
};

/**
 * Provisions a dedicated MongoDB database for a tenant by opening
 * a separate Mongoose connection, writing a metadata document, and closing it.
 */
const provisionTenantDatabase = async (slug, tenantId, companyName) => {
  const uri = buildTenantDbUri(slug);
  const conn = await mongoose.createConnection(uri).asPromise();

  // Write a metadata document so MongoDB actually creates the database on disk
  const MetaSchema = new mongoose.Schema(
    {
      tenantId: String,
      companyName: String,
      slug: String,
      provisionedAt: { type: Date, default: Date.now },
    },
    { collection: '_meta' }
  );

  const Meta = conn.model('_Meta', MetaSchema);
  await Meta.create({ tenantId: tenantId.toString(), companyName, slug });
  await conn.close();
};

export const registerTenant = async (payload, registeredBy) => {
  // 1. Generate slug
  const slug = generateSlug(payload.companyName);
  const dbName = `ems-tenant-${slug}`;
  // tenantUrl = the frontend URL where tenants can log into their workspace
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const tenantUrl = `${frontendUrl}/${slug}`;

  // 2. Check uniqueness
  const existing = await Tenant.findOne({ 
    $or: [{ slug }, { adminEmail: payload.adminEmail }, { companyCode: payload.companyCode }] 
  });
  if (existing) {
    if (existing.slug === slug) {
      throw { status: 409, message: `A company with a similar name already exists (slug: ${slug})` };
    }
    if (existing.companyCode === payload.companyCode) {
      throw { status: 409, message: `A company with this code is already registered (code: ${payload.companyCode})` };
    }
    throw { status: 409, message: 'A tenant with this admin email is already registered' };
  }

  // 3. Generate temporary password
  const tempPassword = generateTempPassword();

  // 4. Create the Tenant record with all provided fields
  const tenant = await Tenant.create({
    ...payload,
    slug,
    dbName,
    tenantUrl,
    registeredBy,
  });

  // 5. Provision dedicated MongoDB database for this tenant
  await provisionTenantDatabase(slug, tenant._id, payload.companyName);

  // 6. Notify auth-service to create company_admin user
  await sendTenantRegisteredEvent({
    tenantId: tenant._id.toString(),
    tenantSlug: slug,
    adminEmail: payload.adminEmail,
    adminName: payload.adminName,
    tempPassword,
    dbName,
    companyName: payload.companyName,
    subscriptionPlan: payload.subscriptionPlan || 'Free',
    billingCycle: payload.billingCycle || 'Monthly',
  });

  // 7. Notify notification-service to send welcome email
  await sendNotificationEvent('notification.tenant_welcome', {
    adminEmail: payload.adminEmail,
    adminName: payload.adminName,
    companyName: payload.companyName,
    tenantUrl,
    tempPassword,
  });

  return {
    id: tenant._id,
    companyName: tenant.companyName,
    companyCode: tenant.companyCode,
    slug: tenant.slug,
    adminEmail: tenant.adminEmail,
    adminName: tenant.adminName,
    dbName: tenant.dbName,
    tenantUrl: tenant.tenantUrl,
    status: tenant.status,
    createdAt: tenant.createdAt,
  };
};

export const getAllTenants = async (token) => {
  const tenants = await Tenant.find({ isDeleted: false }).select('-__v').sort({ createdAt: -1 });
  
  let userCounts = {};
  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4100';
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await axios.get(`${authUrl}/api/v1/auth/stats/tenant-user-counts`, config);
    if (response.data && response.data.success) {
      userCounts = response.data.data || {};
    }
  } catch (error) {
    console.error('Failed to fetch user counts from auth-service:', error.message);
  }

  return tenants.map(t => {
    const tenantObj = t.toObject();
    tenantObj.userCount = userCounts[tenantObj._id.toString()] || 0;
    return tenantObj;
  });
};

export const getTenantsSummary = async (token) => {
  const tenants = await Tenant.find({ isDeleted: false }).select('_id companyName slug status createdAt').sort({ createdAt: -1 });
  
  let userCounts = {};
  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4100';
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await axios.get(`${authUrl}/api/v1/auth/stats/tenant-user-counts`, config);
    if (response.data && response.data.success) {
      userCounts = response.data.data || {};
    }
  } catch (error) {
    console.error('Failed to fetch user counts from auth-service:', error.message);
  }

  return tenants.map(t => ({
    tenantId: t._id,
    companyName: t.companyName,
    slug: t.slug,
    totalUsersCount: userCounts[t._id.toString()] || 0,
    status: t.status,
    createdAt: t.createdAt
  }));
};

export const getCompanyAdmins = async () => {
  const tenants = await Tenant.find({ isDeleted: false }).select('_id adminName adminEmail companyName industryType').sort({ createdAt: -1 });
  
  return tenants.map(t => ({
    id: t._id,
    name: t.adminName,
    email: t.adminEmail,
    companyName: t.companyName,
    department: t.industryType,
    role: 'CompanyAdmin'
  }));
};


export const getTenantBySlug = async (slug) => {
  const tenant = await Tenant.findOne({ slug, isDeleted: false }).select('-__v');
  if (!tenant) throw { status: 404, message: 'Tenant not found' };
  return tenant;
};

export const updateTenantStatus = async (slug, status) => {
  const tenant = await Tenant.findOne({ slug, isDeleted: false });
  if (!tenant) throw { status: 404, message: 'Tenant not found' };

  if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
    throw { status: 400, message: 'Invalid status value' };
  }

  tenant.status = status;
  tenant.isActive = status === 'Active';
  await tenant.save();

  return { id: tenant._id, slug: tenant.slug, status: tenant.status, isActive: tenant.isActive };
};

export const deleteTenant = async (slug) => {
  const tenant = await Tenant.findOne({ slug });
  if (!tenant) throw { status: 404, message: 'Tenant not found' };

  // 1. Drop the dedicated tenant database
  try {
    const uri = buildTenantDbUri(slug);
    const conn = await mongoose.createConnection(uri).asPromise();
    await conn.dropDatabase();
    await conn.close();
    console.log(`Successfully dropped database for tenant: ${slug}`);
  } catch (err) {
    console.error(`Failed to drop database for tenant ${slug}:`, err);
    // Proceed to delete the document and emit event even if dropping fails
  }

  // 2. Permanently delete the tenant document from the main database
  await Tenant.deleteOne({ slug });

  // 3. Notify auth-service and user-service to wipe all associated users
  await sendTenantDeletedEvent({
    tenantId: tenant._id.toString(),
    slug: tenant.slug
  });

  return { id: tenant._id, slug: tenant.slug, isDeleted: true };
};

export const validateTenant = async (tenantId, tenantSlug) => {
  let tenant;
  if (tenantId) {
    tenant = await Tenant.findOne({ _id: tenantId, isDeleted: false });
  } else if (tenantSlug) {
    tenant = await Tenant.findOne({ slug: tenantSlug, isDeleted: false });
  }
  
  if (!tenant) throw { status: 401, message: 'Invalid tenant' };
  if (tenant.status !== 'Active') throw { status: 403, message: 'Tenant is not active' };
  
  return {
    id: tenant._id,
    slug: tenant.slug,
    dbName: tenant.dbName,
    companyName: tenant.companyName
  };
};

export const getDashboardStats = async () => {
  const activeTenants = await Tenant.countDocuments({ status: 'Active', isDeleted: false });
  const totalTenants = await Tenant.countDocuments({ isDeleted: false });
  const tenants = await Tenant.find({ isDeleted: false }).select('_id companyName slug status createdAt');
  
  return {
    activeTenants,
    totalTenants,
    tenants
  };
};
