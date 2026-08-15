import mongoose from "mongoose";
import { authResolvers } from "./auth.js";
import { userResolvers } from "./users.js";
import { examResolvers } from "./exams.js";

export const resolvers = {
  Query: {
    health: async () => {
      const dbState = mongoose.connection.readyState;
      const dbStateMap: Record<number, string> = {
        0: "Disconnected",
        1: "Connected",
        2: "Connecting",
        3: "Disconnecting",
      };

      return {
        status: "OK",
        timestamp: new Date().toISOString(),
        database: dbStateMap[dbState] || "Unknown",
        uptime: process.uptime(),
      };
    },
    ...authResolvers.Query,
    ...userResolvers.Query,
    ...examResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...examResolvers.Mutation,
  },
  User: {
    ...userResolvers.User,
  },
  AuthPayload: authResolvers.AuthPayload,
  Exam: examResolvers.Exam,
};
