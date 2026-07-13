import { subscribeToQueue } from '../config/rabbitmq.js';
import { sendEmail } from '../services/emailService.js';
import { emitToUser, emitToTenant } from '../socket/socketServer.js';
import { tenantWelcomeTemplate } from '../templates/tenantWelcome.js';
import { passwordResetTemplate } from '../templates/passwordReset.js';
import { tenantPasswordResetTemplate } from '../templates/tenantPasswordResetTemplate.js';
import { userWelcomeTemplate } from '../templates/userWelcomeTemplate.js';
import Notification from '../models/Notification.js';

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
      console.log(`[Notification] Expense created by ${employeeName}, saving to DB and broadcasting.`);
      
      // 1. Save and Notify Direct Manager
      if (managerId) {
        try {
          const dbNotif = await Notification.create({
            tenantId,
            userId: managerId,
            text: `New expense submitted by ${employeeName} for ₹${amount}`,
            type: 'expense_created'
          });
          emitToUser(managerId, 'new_notification', {
            id: dbNotif._id,
            text: dbNotif.text,
            time: 'Just now',
            type: dbNotif.type
          });
        } catch (err) {
          console.error('Failed to persist manager notification:', err.message);
        }
      }

      // 2. Save and Notify Auditors
      try {
        const dbAuditor = await Notification.create({
          tenantId,
          role: 'Auditor',
          text: `New expense submitted by ${employeeName} for ₹${amount}`,
          type: 'expense_created'
        });
        const auditorPayload = {
          id: dbAuditor._id,
          text: dbAuditor.text,
          time: 'Just now',
          type: dbAuditor.type
        };
        emitToTenant(`${tenantId}_Auditor`, 'new_notification', auditorPayload);
        emitToTenant(`${tenantId}_auditor`, 'new_notification', auditorPayload);
      } catch (err) {
        console.error('Failed to persist auditor notification:', err.message);
      }

      // 3. Save and Notify Finance
      try {
        const dbFinance = await Notification.create({
          tenantId,
          role: 'Finance Team',
          text: `New expense submitted by ${employeeName} for ₹${amount}`,
          type: 'expense_created'
        });
        const financePayload = {
          id: dbFinance._id,
          text: dbFinance.text,
          time: 'Just now',
          type: dbFinance.type
        };
        emitToTenant(`${tenantId}_Finance Team`, 'new_notification', financePayload);
        emitToTenant(`${tenantId}_Finance`, 'new_notification', financePayload);
        emitToTenant(`${tenantId}_finance`, 'new_notification', financePayload);
      } catch (err) {
        console.error('Failed to persist finance notification:', err.message);
      }
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
        try {
          const dbNotif = await Notification.create({
            tenantId,
            userId: employeeId,
            text: `Your expense claim of ₹${amount} was marked as: ${status}`,
            type: 'expense_status_updated'
          });
          emitToUser(employeeId, 'new_notification', {
            id: dbNotif._id,
            text: dbNotif.text,
            time: 'Just now',
            type: dbNotif.type
          });
        } catch (err) {
          console.error('Failed to persist employee status notification:', err.message);
        }
      }
      
      // If Manager Approved, notify Finance and Auditor
      if (status === 'Manager Approved') {
        try {
          const dbFinance = await Notification.create({
            tenantId,
            role: 'Finance Team',
            text: `A new expense (₹${amount}) was approved by a manager and is ready for finance processing.`,
            type: 'expense_requires_processing'
          });
          const financePayload = {
            id: dbFinance._id,
            text: dbFinance.text,
            time: 'Just now',
            type: dbFinance.type
          };
          emitToTenant(`${tenantId}_Finance Team`, 'new_notification', financePayload);
          emitToTenant(`${tenantId}_Finance`, 'new_notification', financePayload);
          emitToTenant(`${tenantId}_finance`, 'new_notification', financePayload);

          const dbAuditor = await Notification.create({
            tenantId,
            role: 'Auditor',
            text: `A new expense (₹${amount}) was approved by a manager and is ready for finance processing.`,
            type: 'expense_requires_processing'
          });
          const auditorPayload = {
            id: dbAuditor._id,
            text: dbAuditor.text,
            time: 'Just now',
            type: dbAuditor.type
          };
          emitToTenant(`${tenantId}_Auditor`, 'new_notification', auditorPayload);
          emitToTenant(`${tenantId}_auditor`, 'new_notification', auditorPayload);
        } catch (err) {
          console.error('Failed to persist manager-approved notification:', err.message);
        }
      }

      // If Finance Approved/Paid, notify Manager too
      if (status === 'Finance Approved' || status === 'Paid') {
        if (managerId) {
          try {
            const dbNotif = await Notification.create({
              tenantId,
              userId: managerId,
              text: `An expense you approved (₹${amount}) has been ${status}.`,
              type: 'expense_completed'
            });
            emitToUser(managerId, 'new_notification', {
              id: dbNotif._id,
              text: dbNotif.text,
              time: 'Just now',
              type: dbNotif.type
            });
          } catch (err) {
            console.error('Failed to persist finance status notification:', err.message);
          }
        }
      }
    }
  );

  // eslint-disable-next-line no-console
  console.log('[Notification] All listeners active');
};

export default notificationListener;
