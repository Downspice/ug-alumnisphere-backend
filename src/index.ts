import express, { Application, Request, Response, NextFunction } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { connectDB } from "./config/db.js";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./resolvers/index.js";

dotenv.config();

export interface MyContext {
  token?: string;
}

const app: Application = express();
const PORT = Number(process.env.PORT) || 4000;

// Enable CORS for all frontend origins & methods
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  })
);

app.use(express.json());

// Root welcome & status endpoint
app.get("/", (_req: Request, res: Response) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.json({
    status: "OK",
    service: "UG AlumniSphere Express & Apollo GraphQL API",
    version: "1.0.0",
    database: isDbConnected ? "connected" : "connecting/offline",
    endpoints: {
      health: "/health",
      graphql: "/graphql",
    },
    timestamp: new Date().toISOString(),
  });
});

// Dedicated health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  await connectDB();
  const dbState = mongoose.connection.readyState;
  const dbStatusMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    database: dbStatusMap[dbState] || "unknown",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Setup Apollo Server instance
const apolloServer = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  introspection: true,
});

let apolloStartedPromise: Promise<void> | null = null;

async function ensureServerReady() {
  await connectDB();
  if (!apolloStartedPromise) {
    apolloStartedPromise = apolloServer.start();
  }
  await apolloStartedPromise;
}

// Middleware to ensure DB and Apollo are initialized before handling requests
const initMiddleware = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    await ensureServerReady();
    next();
  } catch (error) {
    next(error);
  }
};

app.use("/graphql", initMiddleware);

app.use(
  "/graphql",
  expressMiddleware(apolloServer, {
    context: async ({ req }: { req: Request }) => ({
      token: req.headers.authorization,
    }),
  })
);

// Only listen directly when running locally or not in a serverless environment
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const httpServer = http.createServer(app);
  ensureServerReady().then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Express Server ready at http://localhost:${PORT}`);
      console.log(`📡 GraphQL API ready at http://localhost:${PORT}/graphql`);
      console.log(`🩺 Health check ready at http://localhost:${PORT}/health`);
    });
  });
}

export default app;
