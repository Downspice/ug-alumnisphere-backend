import mongoose from "mongoose";
import { authResolvers } from "./auth.js";
import { userResolvers } from "./users.js";
import { examResolvers } from "./exams.js";
import { verificationResolvers } from "./verification.js";
import { directoryResolvers } from "./directory.js";
import { connectionResolvers } from "./connections.js";
import { notificationResolvers } from "./notifications.js";

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
    ...verificationResolvers.Query,
    ...directoryResolvers.Query,
    ...connectionResolvers.Query,
    ...notificationResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...examResolvers.Mutation,
    ...verificationResolvers.Mutation,
    ...connectionResolvers.Mutation,
    ...notificationResolvers.Mutation,
  },
  User: {
    ...userResolvers.User,
    ...directoryResolvers.User,
  },
  AuthPayload: authResolvers.AuthPayload,
  Exam: examResolvers.Exam,
  VerificationRequest: verificationResolvers.VerificationRequest,
  Connection: connectionResolvers.Connection,
  Notification: notificationResolvers.Notification,
};
