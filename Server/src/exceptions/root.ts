export class HttpException extends Error {
  message: string;
  errorCode: ErrorCode;
  statusCode: number;
  errors: any;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number,
    error: any,
  ) {
    super(message);
    this.message = message;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.errors = error;
  }
}

export enum ErrorCode {
  // User errors
  USER_NOT_FOUND = 1001,
  USER_ALREADY_EXISTS = 1002,
  INCORRECT_PASSWORD = 1003,

  // Validation errors
  UNPROCESSABLE_ENTITY = 2001,

  // Server errors
  INTERNAL_EXCEPTION = 3001,

  // Auth errors
  UNAUTHORIZED = 4001,

  // Product errors
  PRODUCT_NOT_FOUND = 5001,
}

