import dotenv from "dotenv";

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  directUrl: string;
  jwtSecret: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  directUrl: process.env.DIRECT_URL || "",
  jwtSecret: process.env.JWT_SECRET || "changeme",
};

export default config;

