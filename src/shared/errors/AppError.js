export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export function notFoundError(resource = 'Resource') {
  return new AppError(`${resource} was not found.`, {
    statusCode: 404,
    code: 'NOT_FOUND',
  });
}

