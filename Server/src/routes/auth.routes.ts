import { Router } from 'express';
import { login, register } from '../controllers/auth.controller.js';
import { errorHandler } from '../middlewares/errorHandler.js';

const authRoutes: Router = Router();

authRoutes.post('/register', errorHandler(register));
authRoutes.post('/login', errorHandler(login));

export default authRoutes;
