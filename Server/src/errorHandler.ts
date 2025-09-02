import type { Request, Response, NextFunction } from 'express';
import { ErrorCode, HttpException } from './exceptions/root.js';
import { InternalException } from './exceptions/internal-exception.js';
import { ZodError } from 'zod';
import { UnprocessableEntity } from './exceptions/validation.js';

export const errorHandler = (method: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await method(req, res, next);
    } catch (error: any) {
      let exception: HttpException;
      if (error instanceof HttpException) {
        exception = error;
      } else if (error instanceof ZodError) {
        {
          exception = new UnprocessableEntity(
            'UNPROCESSABLE ENTITY',
            ErrorCode.UNPROCESSABLE_ENTITY,
            error.issues,
          );
        }
      } else {
        exception = new InternalException(
          'Something went Wrong!',
          ErrorCode.INTERNAL_EXCEPTION,
          error,
        );
      }
      next(exception);
    }
  };
};
