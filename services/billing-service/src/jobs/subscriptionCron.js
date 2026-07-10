import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import { expireSubscription, suspendSubscription } from '../services/subscriptionService.js';
import { sendNotificationEvent } from '../utils/events.js';

/**
 * Check for expiring subscriptions and send reminders / suspend
 * Runs every hour
 */
export const startSubscriptionCron = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running subscription lifecycle check...');
    const now = new Date();

    try {
      // ─── 1. Send Reminder Notifications ──────────────────
      const activeSubs = await Subscription.find({
        status: { $in: ['Active', 'Trial'] },
        isDeleted: false,
      });

      for (const sub of activeSubs) {
        const daysUntilExpiry = Math.ceil((sub.endDate - now) / (1000 * 60 * 60 * 24));

        // 7-day reminder
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 3 && !sub.remindersSent.sevenDay) {
          await sendNotificationEvent('notification.subscription_reminder', {
            tenantId: sub.tenantId,
            tenantSlug: sub.tenantSlug,
            companyName: sub.companyName,
            planName: sub.planName,
            daysRemaining: daysUntilExpiry,
            endDate: sub.endDate,
            type: '7day',
          });
          sub.remindersSent.sevenDay = true;
          await sub.save();
          console.log(`[CRON] 7-day reminder sent to ${sub.companyName}`);
        }

        // 3-day reminder
        if (daysUntilExpiry <= 3 && daysUntilExpiry > 1 && !sub.remindersSent.threeDay) {
          await sendNotificationEvent('notification.subscription_reminder', {
            tenantId: sub.tenantId,
            tenantSlug: sub.tenantSlug,
            companyName: sub.companyName,
            planName: sub.planName,
            daysRemaining: daysUntilExpiry,
            endDate: sub.endDate,
            type: '3day',
          });
          sub.remindersSent.threeDay = true;
          await sub.save();
          console.log(`[CRON] 3-day reminder sent to ${sub.companyName}`);
        }

        // 1-day reminder
        if (daysUntilExpiry <= 1 && daysUntilExpiry > 0 && !sub.remindersSent.oneDay) {
          await sendNotificationEvent('notification.subscription_reminder', {
            tenantId: sub.tenantId,
            tenantSlug: sub.tenantSlug,
            companyName: sub.companyName,
            planName: sub.planName,
            daysRemaining: daysUntilExpiry,
            endDate: sub.endDate,
            type: '1day',
          });
          sub.remindersSent.oneDay = true;
          await sub.save();
          console.log(`[CRON] 1-day reminder sent to ${sub.companyName}`);
        }
      }

      // ─── 2. Expire Subscriptions Past End Date ───────────
      const expiredSubs = await Subscription.find({
        status: { $in: ['Active', 'Trial'] },
        endDate: { $lte: now },
        isDeleted: false,
      });

      for (const sub of expiredSubs) {
        console.log(`[CRON] Expiring subscription for ${sub.companyName}`);
        await expireSubscription(sub._id);
      }

      // ─── 3. Suspend Subscriptions Past Grace Period ──────
      const pastGraceSubs = await Subscription.find({
        status: 'PastDue',
        graceEndDate: { $lte: now },
        isDeleted: false,
      });

      for (const sub of pastGraceSubs) {
        console.log(`[CRON] Suspending subscription for ${sub.companyName} (grace period ended)`);
        await suspendSubscription(sub._id);
      }

      console.log(`[CRON] Lifecycle check complete. Expired: ${expiredSubs.length}, Suspended: ${pastGraceSubs.length}`);
    } catch (error) {
      console.error('[CRON] Subscription lifecycle check failed:', error);
    }
  });

  console.log('[CRON] Subscription lifecycle cron job started (runs every hour)');
};
