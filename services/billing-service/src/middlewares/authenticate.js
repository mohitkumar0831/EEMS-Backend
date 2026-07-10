import jwt from 'jsonwebtoken';
import { errorResponse } from './errorHandler.js';

export const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return errorResponse({ res, message: 'Authorization header is required', status: 401 });
  }
  const token = authorization.startsWith('Bearer ') ? authorization.split(' ')[1] : authorization;
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return errorResponse({ res, message: 'Invalid or expired token', errors: error.message, status: 401 });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return errorResponse({ res, message: 'Forbidden: insufficient permissions', status: 403 });
  }
  return next();
};
