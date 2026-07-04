import { errorResponse } from '../responses/apiResponse.js';

export const validateRequest = (schema, property = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[property], { abortEarly: false, allowUnknown: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    return errorResponse({ res, message: 'Validation failed', errors, status: 422 });
  }
  return next();
};
