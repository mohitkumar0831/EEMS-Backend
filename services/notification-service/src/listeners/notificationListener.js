import { subscribeToQueue } from '../config/rabbitmq.js';
import { sendEmail } from '../services/emailService.js';
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

  // eslint-disable-next-line no-console
  console.log('[Notification] All listeners active');
};

export default notificationListener;
