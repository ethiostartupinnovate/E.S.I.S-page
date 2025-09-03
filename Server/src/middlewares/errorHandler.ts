import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ErrorCode, HttpException } from "../exceptions/root";
import { InternalException } from "../exceptions/internal-exception";
import { UnprocessableEntity } from "../exceptions/validation";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let exception: HttpException;

  if (err instanceof HttpException) {
    exception = err;
  } else if (err instanceof ZodError) {
    exception = new UnprocessableEntity(
      "UNPROCESSABLE ENTITY",
      ErrorCode.UNPROCESSABLE_ENTITY,
      err.issues
    );
  } else {
    exception = new InternalException(
      "Something went wrong!",
      ErrorCode.INTERNAL_EXCEPTION,
      err
    );
  }

  res.status(exception.statusCode || 500).json({
    message: exception.message,
    code: exception.code,
    details: exception.details || null,
  });
};
