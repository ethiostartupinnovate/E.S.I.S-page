import type { Request, Response, NextFunction } from 'express';
import { prismaClient } from '../app.js';
import { SignUpSchema } from '../schemas/authSchema.js';
import bcrypt from 'bcryptjs';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';

export const register = async (req: Request, res: Response) => {
  const parsed = SignUpSchema.parse(req.body);

  const existingUser = await prismaClient.user.findUnique({
    where: { email: parsed.email },
  });

  if (existingUser) {
    throw new BadRequestsException(
      'User already exists',
      ErrorCode.USER_ALREADY_EXISTS,
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.password, 10);

  const user = await prismaClient.user.create({
    data: {
      email: parsed.email,
      passwordHash: hashedPassword,
    },
    include: { profile: true },
  });

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      createdAt: user.createdAt,
    },
  });
};
