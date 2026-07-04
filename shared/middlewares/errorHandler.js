import { errorResponse } from '../responses/apiResponse.js';
import logger from '../logger/index.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('%s %s %o', err.message, req.originalUrl, err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || null;
  return errorResponse({ res, message, errors, status });
};
