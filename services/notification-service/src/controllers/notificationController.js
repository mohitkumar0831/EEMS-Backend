import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { tenantId, role } = req.user;

    const query = {
      $or: [
        {
          tenantId,
          $or: [
            { userId },
            { role },
            { userId: null, role: null },
            { userId: { $exists: false }, role: { $exists: false } }
          ]
        },
        {
          tenantId: 'platform'
        }
      ]
    };

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(100);

    // Format for frontend mapping
    const formatted = notifications.map(n => ({
      id: n._id,
      text: n.text,
      type: n.type,
      read: n.readBy.includes(userId),
      createdAt: n.createdAt,
      time: formatTime(n.createdAt)
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    await Notification.findByIdAndUpdate(
      id,
      { $addToSet: { readBy: userId } },
      { new: true }
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { tenantId, role } = req.user;

    const query = {
      $or: [
        {
          tenantId,
          $or: [
            { userId },
            { role },
            { userId: null, role: null },
            { userId: { $exists: false }, role: { $exists: false } }
          ]
        },
        {
          tenantId: 'platform'
        }
      ]
    };

    await Notification.updateMany(
      query,
      { $addToSet: { readBy: userId } }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// Helper to format timestamps to relative time
function formatTime(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
