export const successResponse = ({ res, message = '', data = null, status = 200 }) =>
  res.status(status).json({ success: true, message, data, errors: null });

export const errorResponse = ({ res, message = 'Internal server error', errors = null, status = 500 }) =>
  res.status(status).json({ success: false, message, data: null, errors });
