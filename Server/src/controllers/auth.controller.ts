import type { Request, Response, NextFunction } from 'express';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';


export const register = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      throw new BadRequestsException(
        'Invalid request body',
        ErrorCode.USER_ALREADY_EXISTS,
      );
    }

    res.status(201).json({ message: 'User registered', user: { name, email } });
  } catch (error) {
    next(error);
  }
};
