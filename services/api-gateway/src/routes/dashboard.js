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
    const [tenantRes, userRes, expenseRes, billingRes] = await Promise.all([
      fetchWithAuth(`${process.env.TENANT_SERVICE_URL}/api/v1/tenants/dashboard/stats`),
      fetchWithAuth(`${process.env.AUTH_SERVICE_URL}/api/v1/auth/stats/dashboard`),
      fetchWithAuth(`${process.env.EXPENSE_SERVICE_URL}/api/v1/expenses/dashboard/stats`),
      fetchWithAuth(`${process.env.BILLING_SERVICE_URL}/api/v1/billing/subscriptions/stats`)
    ]);

    const tenantStats = tenantRes.data?.data || {};
    const userStats = userRes.data?.data || {};
    const expenseStats = expenseRes.data?.data || {};
    const billingStats = billingRes.data?.data || {};

    // Attach tenant metrics
    if (tenantStats.tenants) {
      tenantStats.tenants = tenantStats.tenants.map(t => {
        const tenantIdStr = (t._id || t.id)?.toString();
        return {
          ...t,
          userCount: userStats.usersPerTenantMap?.[tenantIdStr] || 0,
          userSpend: expenseStats.tenantUserSpendMap?.[tenantIdStr] || 0,
          adminFinancePaid: expenseStats.tenantAdminFinancePaidMap?.[tenantIdStr] || 0
        };
      });
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
        ...billingStats,
        ...policyStats,
        totalSpend: billingStats.totalRevenue || 0, // Override with subscription revenue
        totalRevenue: billingStats.totalRevenue || 0,
        auditLogs
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
