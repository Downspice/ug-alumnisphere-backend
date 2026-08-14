import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { connectDB } from "./config/db.js";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./resolvers/index.js";

dotenv.config();

export interface MyContext {
  token?: string;
}

const PORT = Number(process.env.PORT) || 4000;

async function startServer(): Promise<void> {
  const app: Application = express();
  const httpServer = http.createServer(app);

  // Connect to MongoDB
  await connectDB();

  // Setup Apollo Server
  const server = new ApolloServer<MyContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  // Middleware
  app.use(cors<cors.CorsRequest>());
  app.use(express.json());

  // Health check REST endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Apollo GraphQL endpoint
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }: { req: Request }) => ({
        token: req.headers.authorization,
      }),
    })
  );

  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`🚀 Express Server ready at http://localhost:${PORT}`);
  console.log(`📡 GraphQL API ready at http://localhost:${PORT}/graphql`);
  console.log(`🩺 Health check ready at http://localhost:${PORT}/health`);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
