import { Router } from 'express';
import { register } from '../controllers/auth.controller.js';
import { errorHandler } from '../errorHandler.js';

const authRoutes: Router = Router();

authRoutes.post('/register', errorHandler(register));

export default authRoutes;
