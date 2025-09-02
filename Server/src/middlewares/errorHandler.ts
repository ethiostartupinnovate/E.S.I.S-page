import type { Request, Response, NextFunction } from 'express';
import { HttpException, ErrorCode } from '../exceptions/root.js';

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof HttpException) {
    res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
      errors: error.errors,
    });
  } else {
    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      errorCode: ErrorCode.INTERNAL_EXCEPTION,
      errors: error instanceof Error ? error.message : error,
    });
  }
};
