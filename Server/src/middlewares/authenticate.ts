import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('Auth Header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No Bearer token found');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('Token extraction failed');
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }
    
    interface JwtPayload {
      id?: number;
      userId?: number; // Add userId field which is used in token generation
      email: string;
      role?: string;
    }
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      console.log('Decoded token:', decoded);
      
      // Check for userId (from token generation) or id (fallback)
      const userId = decoded.userId || decoded.id;
      console.log('Using userId:', userId);
      
      if (!userId) {
        console.log('No user ID found in token');
        return res.status(401).json({ message: 'Unauthorized - Invalid token format' });
      }
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
      
      console.log('User found:', user);
      
      if (!user || !user.isActive) {
        console.log('User not found or inactive');
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      
      console.log('User set on request:', req.user);
      next();
    } catch (jwtError: any) {
      console.log('JWT verification failed:', jwtError.message);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
