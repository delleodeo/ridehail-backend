import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../shared/errors/AppError.js";

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(`Route ${req.method} ${req.originalUrl} was not found.`, {
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
    }),
  );
}

export function errorHandler(error, req, res, _next) {
  void _next;
  let normalized = error;

  if (error?.code === 11000) {
    normalized = new AppError("A record with these details already exists.", {
      statusCode: 409,
      code: "DUPLICATE_RECORD",
      details: error.keyValue,
    });
  } else if (error instanceof mongoose.Error.CastError) {
    normalized = new AppError("The supplied identifier is invalid.", {
      statusCode: 400,
      code: "INVALID_IDENTIFIER",
    });
  }

  const isOperational = normalized instanceof AppError;
  const statusCode = isOperational ? normalized.statusCode : 500;

  const log =
    statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    {
      err: error,
      ...(normalized !== error ? { normalizedError: normalized } : {}),
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      userId: req.auth?.userId,
    },
    normalized.message,
  );

  res.status(statusCode).json({
    success: false,
    code: isOperational ? normalized.code : "INTERNAL_ERROR",
    message: isOperational
      ? normalized.message
      : "An unexpected error occurred.",
    ...(normalized.details ? { details: normalized.details } : {}),
    ...(env.NODE_ENV === "development" && !isOperational
      ? { stack: normalized.stack }
      : {}),
  });
}
