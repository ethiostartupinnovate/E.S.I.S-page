import express from "express";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(express.json());

app.use("/api/v1/auth", authRoutes);

app.use(errorHandler);

export default app;
