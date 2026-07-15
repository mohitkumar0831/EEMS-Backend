import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/tenant/:slug/spending', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const authHeader = req.headers.authorization;
    const config = {
      headers: { 
        Authorization: authHeader,
        'x-tenant-id': req.headers['x-tenant-id'],
        'x-tenant-slug': req.headers['x-tenant-slug'],
        'x-tenant-db': req.headers['x-tenant-db']
      }
    };

    const fetchWithAuth = async (url) => {
      try {
        const response = await axios.get(url, config);
        return response.data;
      } catch (e) {
        if (e.response && e.response.status === 401) {
          throw new Error('Unauthorized');
        }
        console.error(`Fetch error for ${url}:`, e.message);
        return { success: false, data: [] };
      }
    };

    // Parallel requests to internal microservices
    const [userRes, expenseRes] = await Promise.all([
      fetchWithAuth(`${process.env.USER_SERVICE_URL || 'http://localhost:4300'}/api/v1/users/tenant/${slug}/employees`),
      fetchWithAuth(`${process.env.EXPENSE_SERVICE_URL || 'http://localhost:4400'}/api/v1/expenses/tenant/${slug}`)
    ]);

    const employees = userRes.data || [];
    const expenses = expenseRes.data || [];

    // Filter to include all roles or users with expenses
    const relevantEmployees = employees.filter(u => {
      const r = (u.role || '').toLowerCase();
      return ['employee', 'manager', 'finance', 'auditor', 'company_admin', 'admin'].includes(r) || expenses.some(e => e.employeeId === (u._id || u.id));
    });

    // Helper to generate deterministic employee ID if missing
    const getEmpId = (emp) => {
      if (emp.employeeId) return emp.employeeId;
      const idStr = emp._id || emp.id || '';
      const suffix = idStr.includes('-') ? idStr.split('-').pop().toUpperCase() : idStr.toUpperCase();
      return `EMP-${suffix.slice(0, 8)}`; // Just take first 8 chars if it's a mongo ID
    };

    // Helper to generate deterministic phone number if missing
    const getPhone = (emp) => {
      if (emp.phone) return emp.phone;
      const idStr = emp._id || emp.id || '';
      const lastChar = idStr.charCodeAt(idStr.length - 1) || 0;
      const mid = (lastChar % 900) + 100;
      const end = (lastChar * 17) % 10000;
      const paddedEnd = String(end).padStart(4, '0');
      return `+1 (555) ${mid}-${paddedEnd}`;
    };

    // Calculate stats for each employee
    const employeeReportData = relevantEmployees.map(emp => {
      const empIdStr = emp._id || emp.id;
      const empExpenses = expenses.filter(e => e.employeeId === empIdStr);
      const approvedSpend = empExpenses
        .filter(e => ['approved', 'paid', 'audited'].includes((e.status || '').toLowerCase()))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const pendingSpend = empExpenses
        .filter(e => ['pending', 'under review', 'manager approved', 'finance approved', 'submitted'].includes((e.status || '').toLowerCase()))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const disbursedSpend = empExpenses
        .filter(e => ['paid', 'audited'].includes((e.status || '').toLowerCase()))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalClaimsCount = empExpenses.length;

      // Normalize employee role
      let roleDisplay = emp.role;
      if (roleDisplay === 'employee' || roleDisplay === 'Employee') roleDisplay = 'Employee';
      else if (roleDisplay === 'manager') roleDisplay = 'Manager';
      else if (roleDisplay === 'finance') roleDisplay = 'Finance Team';
      else if (roleDisplay === 'auditor') roleDisplay = 'Auditor';
      else if (roleDisplay === 'company_admin') roleDisplay = 'CompanyAdmin';

      return {
        user: {
          id: empIdStr,
          name: emp.firstName ? `${emp.firstName} ${emp.lastName}` : (emp.name || 'Unknown'),
          email: emp.email,
          department: emp.department,
          role: roleDisplay,
        },
        empId: getEmpId(emp),
        phone: getPhone(emp),
        approvedSpend,
        pendingSpend,
        disbursedSpend,
        totalReimbursed: disbursedSpend,
        totalClaimsCount,
        expenses: empExpenses
      };
    });

    const totalSpending = employeeReportData.reduce((sum, item) => sum + item.disbursedSpend, 0);

    res.status(200).json({
      success: true,
      message: 'Spend report retrieved successfully',
      totalSpending, // total amount paid by companyAdmin and finance
      data: employeeReportData
    });

  } catch (error) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next(error);
  }
});

export default router;
