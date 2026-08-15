import { ApolloServer } from "@apollo/server";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { typeDefs } from "../src/schema/typeDefs.js";
import { resolvers } from "../src/resolvers/index.js";
import { User, type IUser, type UserRole } from "../src/models/User.js";
import { hashPassword } from "../src/utils/auth.js";
import type { MyContext } from "../src/types/context.js";

let server: ApolloServer | null = null;
let memory: MongoMemoryServer | null = null;

export async function startTestDb() {
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri(), { dbName: "ug_alumnisphere_test" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
}

export async function stopTestDb() {
  if (server) await server.stop();
  server = null;
  await mongoose.disconnect();
  await memory?.stop();
  memory = null;
}

export async function resetDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

export async function createUser(
  overrides: {
    name?: string;
    email: string;
    role?: UserRole;
    openToMentor?: boolean;
  } = { email: `user-${Date.now()}@test.ug` }
): Promise<IUser> {
  return User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email,
    passwordHash: await hashPassword("AlumniSphere#2026"),
    role: overrides.role ?? "alumni",
    accountStatus: "active",
    verificationStatus: "verified",
    openToMentor: overrides.openToMentor ?? false,
  });
}

export function contextFor(user: IUser | null = null): MyContext {
  return { token: undefined, user };
}

export async function execute<T = Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown> = {},
  user: IUser | null = null
) {
  if (!server) throw new Error("Test Apollo server is not started.");
  const result = await server.executeOperation(
    { query, variables },
    { contextValue: contextFor(user) }
  );
  if (result.body.kind !== "single") {
    throw new Error("Expected a single GraphQL result");
  }
  return result.body.singleResult as {
    data?: T;
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };
}

export function errorCode(errors?: Array<{ extensions?: { code?: string } }>) {
  return errors?.[0]?.extensions?.code;
}
