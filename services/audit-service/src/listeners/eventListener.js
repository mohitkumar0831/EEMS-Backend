import { subscribeToQueue } from '../config/rabbitmq.js';
import AuditLog from '../models/AuditLog.js';

const EXCHANGE_NAME = 'eems_exchange';

const eventToAuditMapper = (routingKey, payload) => {
  const log = {
    tenantId: payload.tenantId || payload.tenantSlug || 'platform',
    action: routingKey,
    user: 'System',
    details: 'System event triggered',
    metadata: payload,
  };

  switch (routingKey) {
    case 'tenant.registered':
      log.user = payload.companyAdminEmail || 'System';
      log.details = `New tenant registered: ${payload.companyName} (${payload.tenantSlug})`;
      break;
    case 'tenant.status_updated':
      log.user = 'SuperAdmin';
      log.details = `Tenant ${payload.tenantSlug} status updated to ${payload.status}`;
      break;
    case 'employee.registered':
      log.user = payload.email || 'System';
      log.details = `New employee registered: ${payload.email} under tenant ${payload.tenantSlug}`;
      break;
    case 'expense.created':
      log.user = payload.employeeName || payload.employeeId || 'System';
      log.details = `Expense submitted for ${payload.amount} in category ${payload.category}`;
      log.targetId = payload.expenseId;
      break;
    case 'expense.status_updated':
      log.user = payload.updatedBy || 'System';
      log.details = `Expense ${payload.expenseId} status changed to ${payload.status}`;
      log.targetId = payload.expenseId;
      break;
    case 'billing.payment_success':
      log.user = 'System';
      log.details = `Payment successful for order ${payload.orderId}, plan: ${payload.planName}`;
      log.targetId = payload.orderId;
      break;
    case 'audit.log':
      log.user = payload.user || 'System';
      log.details = payload.details || 'Audit event';
      log.action = payload.action || 'Manual Audit';
      break;
    default:
      // Don't log unrecognized events to avoid spam
      return null;
  }
  return log;
};

export const startEventListener = async () => {
  try {
    await subscribeToQueue(
      EXCHANGE_NAME,
      '#', // Listen to all topics
      'audit_service_queue',
      async (payload, routingKey) => {
        const logData = eventToAuditMapper(routingKey, payload);
        
        if (logData) {
          const auditLog = new AuditLog(logData);
          await auditLog.save();
        }
      }
    );
    console.log('Audit service listening for events on eems_exchange');
  } catch (error) {
    console.error('Failed to start audit event listener:', error);
  }
};
