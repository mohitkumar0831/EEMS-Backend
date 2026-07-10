import AuditLog from '../models/AuditLog.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { tenantId, action, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (tenantId) query.tenantId = tenantId;
    if (action) query.action = action;

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(query);

    // Format for frontend mapping
    const formattedLogs = logs.map(log => ({
      id: log._id,
      tenantId: log.tenantId,
      action: log.action,
      user: log.user,
      details: log.details,
      timestamp: log.timestamp,
    }));

    res.json({
      success: true,
      data: formattedLogs,
      meta: {
        total,
        limit: Number(limit),
        skip: Number(skip),
      }
    });
  } catch (err) {
    console.error('Error in getAuditLogs:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving audit logs.' });
  }
};
