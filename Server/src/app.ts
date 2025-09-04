import express from 'express';
import { PrismaClient } from './generated/prisma/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import articleRoutes from './routes/article.routes.js';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
const app = express();

app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', articleRoutes);
app.use('/api/v1', projectRoutes);

export const prismaClient = new PrismaClient();

app.use(errorHandler);

export default app;
