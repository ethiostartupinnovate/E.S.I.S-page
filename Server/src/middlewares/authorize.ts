import type { NextFunction, Request, Response } from 'express';

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log('Authorize middleware - Required roles:', roles);
    console.log('Authorize middleware - User:', req.user);
    
    if (!req.user) {
      console.log('No user object found on request');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`User role ${req.user.role} not in allowed roles:`, roles);
      return res.status(403).json({ message: 'Forbidden' });
    }

    console.log('Authorization successful');
    next();
  };
};
