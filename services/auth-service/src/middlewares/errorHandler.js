export const errorResponse = ({ res, message = 'Internal server error', errors = null, status = 500 }) =>
  res.status(status).json({ success: false, message, data: null, errors });

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || null;
  return errorResponse({ res, message, errors, status });
};
