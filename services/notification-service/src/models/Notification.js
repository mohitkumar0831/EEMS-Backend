import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
  },
  userId: {
    type: String, // target user ID (e.g., direct manager, employee)
    required: false,
    index: true,
  },
  role: {
    type: String, // target role if broadcast to room (e.g., "Finance Team", "Auditor")
    required: false,
  },
  text: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  readBy: {
    type: [String], // Array of User IDs who have read/dismissed this
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  }
});

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
