import { AppError } from '../shared/errors/AppError.js';

export function authorize(...allowedRoles) {
  return function authorizationMiddleware(req, _res, next) {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', {
          statusCode: 403,
          code: 'FORBIDDEN',
        }),
      );
    }
    return next();
  };
}

