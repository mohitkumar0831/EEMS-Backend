import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/superadmin', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const config = {
      headers: { Authorization: authHeader }
    };

    const fetchWithAuth = async (url) => {
      try {
        const res = await axios.get(url, config);
        return res;
      } catch (e) {
        if (e.response && e.response.status === 401) {
          throw new Error('Unauthorized');
        }
        console.error(`Fetch error for ${url}:`, e.message);
        return { data: { data: {} } };
      }
    };

    // Parallel requests to internal microservices
    const [tenantRes, userRes, expenseRes] = await Promise.all([
      fetchWithAuth(`${process.env.TENANT_SERVICE_URL}/api/v1/tenants/dashboard/stats`),
      fetchWithAuth(`${process.env.AUTH_SERVICE_URL}/api/v1/auth/stats/dashboard`),
      fetchWithAuth(`${process.env.EXPENSE_SERVICE_URL}/api/v1/expenses/dashboard/stats`)
    ]);

    const tenantStats = tenantRes.data?.data || {};
    const userStats = userRes.data?.data || {};
    const expenseStats = expenseRes.data?.data || {};

    // Attach user counts to tenants
    if (tenantStats.tenants && userStats.usersPerTenantMap) {
      tenantStats.tenants = tenantStats.tenants.map(t => ({
        ...t,
        userCount: userStats.usersPerTenantMap[t._id.toString()] || 0
      }));
    }

    // Mock policy and audit data for now
    const policyStats = { activePolicies: 5, pendingTravel: 2 };
    const auditLogs = [
      { id: '1', action: 'System Update', details: 'Deployed v1.2', user: 'System', timestamp: new Date() }
    ];

    res.status(200).json({
      success: true,
      data: {
        ...tenantStats,
        ...userStats,
        ...expenseStats,
        ...policyStats,
        auditLogs
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
