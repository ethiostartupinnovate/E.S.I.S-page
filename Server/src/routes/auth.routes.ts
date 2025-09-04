import { Router } from 'express';
import { getCurrentUser, login, register } from '../controllers/auth.controller.js';
import { errorHandler } from '../errorHandler.js';
import { authenticate } from '../middlewares/authenticate.js';

const authRoutes: Router = Router();

authRoutes.post('/register', errorHandler(register));
authRoutes.post('/login', errorHandler(login));
authRoutes.get('/me', authenticate, errorHandler(getCurrentUser));

export default authRoutes;
