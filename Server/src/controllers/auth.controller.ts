import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prismaClient } from '../app.js';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';
import { LoginSchema, SignUpSchema } from '../schemas/authSchema.js';

// sign up
const register = async (req: Request, res: Response) => {
  const parsed = SignUpSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prismaClient.user.findUnique({
    where: { email: parsed.email },
  });

  if (existingUser) {
    throw new BadRequestsException(
      'User already exists',
      ErrorCode.USER_ALREADY_EXISTS,
    );
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(parsed.password, 10);

  // Create user with hashed password
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

// login
type UserRole = 'ADMIN' | 'MEMBER' | 'USER';

const setCookieConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
};

const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.parse(req.body);
    const { role }: { role: UserRole } = req.body;

    // Validate required fields
    if (!parsed.email || !parsed.password || !role) {
      res.status(400).json({
        message: 'Email, password, and role are required',
      });
      return;
    }

    // Validate role
    const allowedRoles: UserRole[] = ['ADMIN', 'MEMBER', 'USER'];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({
        message: 'Invalid role',
      });
      return;
    }

    // Find user by email and role
    const user = await prismaClient.user.findFirst({
      where: {
        email: parsed.email,
        role: role,
        isActive: true,
      },
    });

    if (!user) {
      throw new BadRequestsException(
        'User not found',
        ErrorCode.USER_NOT_FOUND,
      );
    }

    // Check password (fix here ✅)
    const isPasswordValid = await bcrypt.compare(
      parsed.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestsException(
        'Invalid credentials',
        ErrorCode.INCORRECT_PASSWORD,
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '24h' },
    );

    // Set cookie
    res.cookie('token', token, setCookieConfig());

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Internal server error',
    });
  }
};

export { login, register };

