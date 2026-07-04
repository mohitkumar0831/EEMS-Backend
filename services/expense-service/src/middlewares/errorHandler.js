export const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[Expense Service Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  return res.status(status).json({ success: false, message, data: null, errors: err.errors || null });
};
