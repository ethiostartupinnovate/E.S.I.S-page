import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth.routes";
import internshipRoutes from "./routes/internships";
import startupRoutes from "./routes/startups";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/internships", internshipRoutes);
app.use("/api/v1/startups", startupRoutes);

// Health check
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Global Prisma client
export const prismaClient = new PrismaClient();

// Error handler
app.use(errorHandler);

export default app;
