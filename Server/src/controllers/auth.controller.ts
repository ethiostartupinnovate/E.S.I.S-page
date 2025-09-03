import type { Request, Response, NextFunction } from 'express';
import { prismaClient } from '../app.js';
import { LoginSchema, SignUpSchema } from '../schemas/authSchema.js';
import bcrypt from 'bcryptjs';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';
import jwt from 'jsonwebtoken'



// sign up
const register = async (req: Request, res: Response) => {
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


// login
type UserRole = "ADMIN" | "MEMBER" | "USER";

const setCookieConfig = (token: string) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieConfig = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" as const : "lax" as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };

  return { cookieConfig };
};

const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.parse(req.body);
    const { role }: { role: UserRole } = req.body;

    // Validate required fields
    if (!parsed.email || !parsed.password || !role) {
      res.status(400).json({
        message: "Email, password, and role are required",
      });
      return;
    }

    // Validate role
    const allowedRoles: UserRole[] = ["ADMIN", "MEMBER", "USER"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({
        message: "Invalid role",
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
        'user not found',
        ErrorCode.USER_NOT_FOUND
      )
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(parsed.password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestsException(
        "Invalid credentials",
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
      process.env.JWT_SECRET || "secret-key",
      { expiresIn: "24h" }
    );

    // Set cookie using centralized config
    const { cookieConfig } = setCookieConfig(token);
    res.cookie("token", token, cookieConfig);


    res.status(200).json({
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};



export { register, login };

