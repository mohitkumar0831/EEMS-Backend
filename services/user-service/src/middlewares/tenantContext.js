export const tenantContext = (req, res, next) => {
  const tenantDb = req.headers['x-tenant-db'];
  const tenantSlug = req.headers['x-tenant-slug'];
  const tenantId = req.headers['x-tenant-id'];
  const tenantPlan = req.headers['x-tenant-plan'];

  if (!tenantDb || !tenantSlug) {
    return res.status(401).json({ 
      success: false, 
      message: 'Tenant context missing in headers',
      data: null
    });
  }

  req.tenant = {
    id: tenantId,
    dbName: tenantDb,
    slug: tenantSlug,
    subscriptionPlan: tenantPlan || 'Free',
  };
  
  next();
};
