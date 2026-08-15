import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { GraphQLError } from "graphql";
import { expressMiddleware } from "@as-integrations/express5";
import { connectDB } from "./config/db.js";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./resolvers/index.js";
import { resolveUserFromToken } from "./utils/auth.js";
import type { MyContext } from "./types/context.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { ensureStorageBuckets, isStorageConfigured } from "./utils/storage.js";

dotenv.config();

export type { MyContext };

function getAllowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const app: Application = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin '${origin}' is not allowed by CORS.`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  })
);

app.use(express.json());

// Root welcome & status endpoint
app.get("/", (_req: Request, res: Response) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "OK",
    service: "UG AlumniSphere Express & Apollo GraphQL API",
    version: "1.0.0",
    database: isDbConnected ? "connected" : "connecting/offline",
    endpoints: {
      health: "/health",
      graphql: "/graphql",
      uploads: "/uploads",
      files: "/files/:id",
      storageStatus: "/storage/status",
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

// Setup Apollo Server instance with structured error formatting
const apolloServer = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  introspection: true,
  formatError: (formattedError, error) => {
    // Log unexpected errors on the server
    console.error("[GraphQL Error]:", {
      message: formattedError.message,
      code: formattedError.extensions?.code,
      path: formattedError.path,
      originalError: error,
    });

    return {
      message: formattedError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: formattedError.extensions?.code || "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
      },
    };
  },
});

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initServer(): Promise<void> {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      registerUploadRoutes(app);
      if (isStorageConfigured()) {
        await ensureStorageBuckets().catch((error) => {
          console.warn("[storage] Bucket setup skipped:", error);
        });
      } else {
        console.warn(
          "[storage] Supabase is not configured. File uploads will fail until keys are set."
        );
      }
      await apolloServer.start();
      // Mount GraphQL expressMiddleware after start() completes
      app.use(
        "/graphql",
        expressMiddleware(apolloServer, {
          context: async ({ req }: { req: Request }): Promise<MyContext> => {
            const header = req.headers.authorization;
            const token = Array.isArray(header) ? header[0] : header;
            const user = await resolveUserFromToken(token);
            return { token, user };
          },
        })
      );

      // Global Express 404 Handler
      app.use((req: Request, res: Response) => {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: `Route '${req.method} ${req.originalUrl}' not found.`,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Global Express 500 Error Handler
      app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
        console.error("[Express Server Error]:", err);
        res.status(500).json({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: err.message || "An unexpected internal server error occurred.",
            timestamp: new Date().toISOString(),
          },
        });
      });

      isInitialized = true;
    })();
  }
  return initPromise;
}

// Only listen directly when running locally outside of serverless
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const httpServer = http.createServer(app);
  initServer().then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Express Server ready at http://localhost:${PORT}`);
      console.log(`📡 GraphQL API ready at http://localhost:${PORT}/graphql`);
      console.log(`🩺 Health check ready at http://localhost:${PORT}/health`);
    });
  });
}

export default app;
