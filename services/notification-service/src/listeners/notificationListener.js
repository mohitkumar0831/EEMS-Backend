import { subscribeToQueue } from '../config/rabbitmq.js';
import { sendEmail } from '../services/emailService.js';
import { emitToUser, emitToTenant } from '../socket/socketServer.js';
import { tenantWelcomeTemplate } from '../templates/tenantWelcome.js';
import { passwordResetTemplate } from '../templates/passwordReset.js';
import { tenantPasswordResetTemplate } from '../templates/tenantPasswordResetTemplate.js';
import { userWelcomeTemplate } from '../templates/userWelcomeTemplate.js';

const notificationListener = async () => {
  // --- Tenant Welcome Email ---
  await subscribeToQueue(
    'ems.events',
    'notification.tenant_welcome',
    'notification.tenant.welcome',
    async ({ adminEmail, adminName, companyName, tenantUrl, tempPassword }) => {
      // eslint-disable-next-line no-console
      console.log(`[Notification] Sending welcome email to ${adminEmail}`);
      const { subject, html } = tenantWelcomeTemplate({ adminName, companyName, tenantUrl, tempPassword });
      await sendEmail({ to: adminEmail, subject, html });
    }
  );

  // --- User Welcome Email ---
  await subscribeToQueue(
    'ems.events',
    'employee.registered',
    'notification.user.welcome',
    async ({ email, name, role, tenantSlug, password }) => {
      console.log(`[Notification] Sending user welcome email to ${email} (Role: ${role})`);
      const { subject, html } = userWelcomeTemplate({ name, email, role, tenantSlug, password });
      await sendEmail({ to: email, subject, html });
    }
  );

  // --- Password Reset Email ---
  await subscribeToQueue(
    'ems.events',
    'notification.password_reset',
    'notification.password.reset',
    async ({ email, name, resetToken }) => {
      // eslint-disable-next-line no-console
      console.log(`[Notification] Sending password reset email to ${email}`);
      const { subject, html } = passwordResetTemplate({ name, resetToken });
      await sendEmail({ to: email, subject, html });
    }
  );

  // --- Tenant Password Reset Email ---
  await subscribeToQueue(
    'ems.events',
    'notification.tenant_password_reset',
    'notification.tenant.password.reset',
    async ({ email, name, resetToken, tenantSlug }) => {
      // eslint-disable-next-line no-console
      console.log(`[Notification] Sending tenant password reset email to ${email}`);
      const { subject, html } = tenantPasswordResetTemplate({ name, resetToken, tenantSlug });
      await sendEmail({ to: email, subject, html });
    }
  );

  // --- Real-time Socket Notification: Expense Created ---
  await subscribeToQueue(
    'ems.events',
    'notification.expense.created',
    'notification.expense_created_queue',
    async ({ tenantId, managerId, expenseId, employeeName, amount }) => {
      console.log(`[Notification] Expense created by ${employeeName}, notifying manager ${managerId} and finance/auditors.`);
      
      const payload = {
        id: expenseId || Date.now(),
        text: `New expense submitted by ${employeeName} for $${amount}`,
        time: 'Just now',
        type: 'expense_created'
      };

      // 1. Notify the direct manager
      if (managerId) {
        emitToUser(managerId, 'new_notification', payload);
      }
      // 2. Notify Auditors
      emitToTenant(`${tenantId}_Auditor`, 'new_notification', payload);
      emitToTenant(`${tenantId}_auditor`, 'new_notification', payload); // fallback
      // 3. Notify Finance
      emitToTenant(`${tenantId}_Finance Team`, 'new_notification', payload);
      emitToTenant(`${tenantId}_Finance`, 'new_notification', payload);
      emitToTenant(`${tenantId}_finance`, 'new_notification', payload); // fallback
    }
  );

  // --- Real-time Socket Notification: Expense Status Updated ---
  await subscribeToQueue(
    'ems.events',
    'notification.expense.status_updated',
    'notification.expense_status_queue',
    async ({ tenantId, expenseId, employeeId, managerId, status, amount }) => {
      console.log(`[Notification] Expense status updated to ${status}`);
      
      // Notify the employee who created it
      if (employeeId) {
        emitToUser(employeeId, 'new_notification', {
          id: expenseId + '_' + Date.now(),
          text: `Your expense claim of $${amount} was marked as: ${status}`,
          time: 'Just now',
          type: 'expense_status_updated'
        });
      }
      
      // If Manager Approved, notify Finance and Auditor
      if (status === 'Manager Approved') {
        const payloadForFinance = {
          id: expenseId + '_fin_' + Date.now(),
          text: `A new expense ($${amount}) was approved by a manager and is ready for finance processing.`,
          time: 'Just now',
          type: 'expense_requires_processing'
        };
        emitToTenant(`${tenantId}_Finance Team`, 'new_notification', payloadForFinance);
        emitToTenant(`${tenantId}_Finance`, 'new_notification', payloadForFinance);
        emitToTenant(`${tenantId}_Auditor`, 'new_notification', payloadForFinance);
      }

      // If Finance Approved/Paid, notify Manager too
      if (status === 'Finance Approved' || status === 'Paid') {
        if (managerId) {
          emitToUser(managerId, 'new_notification', {
            id: expenseId + '_mgr_' + Date.now(),
            text: `An expense you approved ($${amount}) has been ${status}.`,
            time: 'Just now',
            type: 'expense_completed'
          });
        }
      }
    }
  );

  // eslint-disable-next-line no-console
  console.log('[Notification] All listeners active');
};

export default notificationListener;
