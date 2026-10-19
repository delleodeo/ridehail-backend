import { AppError } from '../shared/errors/AppError.js';

export function validate(schema) {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });

    if (!result.success) {
      return next(
        new AppError('Request validation failed.', {
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: result.error.issues.map(({ path, message, code }) => ({ path, message, code })),
        }),
      );
    }

    req.validated = result.data;
    return next();
  };
}

