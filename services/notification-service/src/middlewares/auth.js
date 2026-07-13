import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key');
    req.user = decoded; // { userId, role, tenantId, ... }
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

export default auth;
