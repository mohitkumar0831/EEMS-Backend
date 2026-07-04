import axios from 'axios';
import { errorResponse } from './errorHandler.js';

const tenantValidation = async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  
  // Also support extracting the slug directly from the proxy path
  // e.g., /api/v1/users/tenant/tech-nova-innovations/employees => /tenant/tech-nova-innovations/employees
  const slugMatch = req.url.match(/\/tenant\/([^/]+)/);
  const tenantSlug = slugMatch ? slugMatch[1] : req.headers['x-tenant-slug'];

  if (!tenantId && !tenantSlug) {
    return errorResponse({ res, message: 'Tenant ID header or tenant slug in URL is required', status: 401 });
  }

  try {
    const result = await axios.get(`${process.env.TENANT_SERVICE_URL}/api/v1/tenants/validate`, {
      headers: { 
        'x-tenant-id': tenantId || '',
        'x-tenant-slug': tenantSlug || ''
      },
    });
    if (result.data && result.data.success) {
      req.tenant = result.data.data;
      req.headers['x-tenant-db'] = req.tenant.dbName;
      req.headers['x-tenant-slug'] = req.tenant.slug;
      if (req.tenant.id) req.headers['x-tenant-id'] = req.tenant.id.toString();
      return next();
    }
    return errorResponse({ res, message: result.data.message || 'Tenant validation failed', status: 401 });
  } catch (error) {
    return errorResponse({ res, message: 'Tenant validation request failed', errors: error.message, status: 502 });
  }
};

export default tenantValidation;
