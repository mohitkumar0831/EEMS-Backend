import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { generateSlug } from '../utils/slug.js';
import { generateTempPassword } from '../utils/password.js';
import { sendTenantRegisteredEvent, sendNotificationEvent } from '../utils/events.js';

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
  // tenantUrl = the actual login API endpoint tenants use to authenticate
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4100';
  const tenantUrl = `${authServiceUrl}/api/v1/auth/tenant/${slug}/login`;

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

export const getAllTenants = async () => {
  return Tenant.find({ isDeleted: false }).select('-__v').sort({ createdAt: -1 });
};

export const getTenantBySlug = async (slug) => {
  const tenant = await Tenant.findOne({ slug, isDeleted: false }).select('-__v');
  if (!tenant) throw { status: 404, message: 'Tenant not found' };
  return tenant;
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
