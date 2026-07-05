import { subscribeToQueue } from '../config/rabbitmq.js';
import { sendEmail } from '../services/emailService.js';
import { emitToUser, emitToTenant } from '../socket/socketServer.js';
import { tenantWelcomeTemplate } from '../templates/tenantWelcome.js';
import { passwordResetTemplate } from '../templates/passwordReset.js';

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
      emitToTenant(`${tenantId}_auditor`, 'new_notification', payload);
      // 3. Notify Finance
      emitToTenant(`${tenantId}_finance`, 'new_notification', payload);
    }
  );

  // eslint-disable-next-line no-console
  console.log('[Notification] All listeners active');
};

export default notificationListener;
