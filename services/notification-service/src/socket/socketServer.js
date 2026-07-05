import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;
// Keep track of connected users: { userId: socketId }
const userSockets = new Map();

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for dev
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      // Decode and verify the token.
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key');
      socket.user = decoded; // { userId, role, tenantId, ... }
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId || socket.user.id;
    console.log(`[Socket] User connected: ${userId} with socket id: ${socket.id}`);
    
    userSockets.set(userId, socket.id);

    // Join a tenant room and role room for broadcast notifications
    if (socket.user.tenantId) {
      socket.join(socket.user.tenantId);
      if (socket.user.role) {
        socket.join(`${socket.user.tenantId}_${socket.user.role}`);
      }
    }

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`);
      userSockets.delete(userId);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToUser = (userId, eventName, payload) => {
  const socketId = userSockets.get(userId);
  if (socketId && io) {
    io.to(socketId).emit(eventName, payload);
  } else {
    console.log(`[Socket] User ${userId} not connected, could not emit ${eventName}`);
  }
};

export const emitToTenant = (tenantId, eventName, payload) => {
  if (io) {
    io.to(tenantId).emit(eventName, payload);
  }
};
