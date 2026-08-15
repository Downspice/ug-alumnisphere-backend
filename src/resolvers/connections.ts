import mongoose from "mongoose";
import { User, IUser } from "../models/User.js";
import { Connection, connectionPairKey, IConnection } from "../models/Connection.js";
import type { MyContext } from "../types/context.js";
import { requireAuth } from "../utils/auth.js";
import {
  assertValidObjectId,
  badUserInput,
  forbidden,
  internalError,
  notFound,
} from "../utils/errors.js";
import { notify } from "../utils/notify.js";

async function loadUser(id: mongoose.Types.ObjectId | string) {
  const user = await User.findById(id);
  if (!user) notFound("Connected user no longer exists.");
  return user;
}

export const connectionResolvers = {
  Query: {
    myConnections: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Connection.find({
          status: "accepted",
          $or: [{ requesterId: user._id }, { addresseeId: user._id }],
        }).sort({ updatedAt: -1 });
      } catch (error) {
        internalError("Failed to load connections.", error);
      }
    },

    pendingConnectionRequests: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Connection.find({
          addresseeId: user._id,
          status: "pending",
        }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load pending requests.", error);
      }
    },

    sentConnectionRequests: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Connection.find({
          requesterId: user._id,
          status: "pending",
        }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load sent requests.", error);
      }
    },

    suggestedConnections: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        const existing = await Connection.find({
          $or: [{ requesterId: user._id }, { addresseeId: user._id }],
          status: { $in: ["pending", "accepted"] },
        });
        const excluded = new Set<string>([
          user._id.toString(),
          ...existing.map((item) =>
            item.requesterId.toString() === user._id.toString()
              ? item.addresseeId.toString()
              : item.requesterId.toString()
          ),
        ]);

        const candidates = await User.find({
          _id: { $nin: [...excluded] },
          role: { $in: ["alumni", "student"] },
          accountStatus: "active",
        }).limit(40);

        const scored = candidates
          .map((candidate) => {
            const reasons: string[] = [];
            if (
              user.programme &&
              candidate.programme &&
              user.programme === candidate.programme
            ) {
              reasons.push("Same programme");
            }
            if (
              user.graduationYear &&
              candidate.graduationYear &&
              user.graduationYear === candidate.graduationYear
            ) {
              reasons.push("Same graduation year");
            }
            if (
              user.industry &&
              candidate.industry &&
              user.industry === candidate.industry
            ) {
              reasons.push("Same industry");
            }
            if (
              user.location &&
              candidate.location &&
              user.location === candidate.location
            ) {
              reasons.push("Same location");
            }
            const sharedSkills = (user.skills ?? []).filter((skill) =>
              (candidate.skills ?? []).includes(skill)
            );
            if (sharedSkills.length > 0) {
              reasons.push(`Shared skills: ${sharedSkills.slice(0, 3).join(", ")}`);
            }
            return { user: candidate, reasons, score: reasons.length };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map(({ user: suggested, reasons }) => ({ user: suggested, reasons }));

        return scored;
      } catch (error) {
        internalError("Failed to load suggested connections.", error);
      }
    },

    connectionStatus: async (
      _: unknown,
      { userId }: { userId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(userId, "User ID", mongoose);
      if (userId === user._id.toString()) return null;
      const pairKey = connectionPairKey(user._id.toString(), userId);
      return Connection.findOne({ pairKey });
    },
  },

  Mutation: {
    sendConnectionRequest: async (
      _: unknown,
      { userId }: { userId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(userId, "User ID", mongoose);
      if (userId === user._id.toString()) {
        badUserInput("You cannot connect with yourself.");
      }

      const target = await User.findById(userId);
      if (!target || target.accountStatus !== "active") {
        notFound("That person is not available to connect.");
      }

      const pairKey = connectionPairKey(user._id.toString(), userId);

      try {
        const existing = await Connection.findOne({ pairKey });
        if (existing?.status === "accepted") {
          badUserInput("You are already connected.");
        }
        if (existing?.status === "pending") {
          badUserInput("A connection request is already pending.");
        }
        if (existing?.status === "declined") {
          existing.requesterId = user._id as mongoose.Types.ObjectId;
          existing.addresseeId = target._id as mongoose.Types.ObjectId;
          existing.status = "pending";
          const saved = await existing.save();
          await notify({
            userId: userId,
            title: "New connection request",
            body: `${user.name} wants to connect with you.`,
            href: "/network",
          });
          return saved;
        }

        const created = await Connection.create({
          requesterId: user._id,
          addresseeId: target._id,
          pairKey,
          status: "pending",
        });
        await notify({
          userId: userId,
          title: "New connection request",
          body: `${user.name} wants to connect with you.`,
          href: "/network",
        });
        return created;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("A connection request is already pending.");
        }
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to send connection request.", error);
      }
    },

    acceptConnectionRequest: async (
      _: unknown,
      { id }: { id: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Connection ID", mongoose);
      try {
        const connection = await Connection.findById(id);
        if (!connection) notFound("Connection request not found.");
        if (connection.addresseeId.toString() !== user._id.toString()) {
          forbidden("Only the recipient can accept this request.");
        }
        if (connection.status !== "pending") {
          badUserInput("This request is no longer pending.");
        }
        connection.status = "accepted";
        return await connection.save();
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to accept connection request.", error);
      }
    },

    declineConnectionRequest: async (
      _: unknown,
      { id }: { id: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Connection ID", mongoose);
      try {
        const connection = await Connection.findById(id);
        if (!connection) notFound("Connection request not found.");
        if (connection.addresseeId.toString() !== user._id.toString()) {
          forbidden("Only the recipient can decline this request.");
        }
        if (connection.status !== "pending") {
          badUserInput("This request is no longer pending.");
        }
        connection.status = "declined";
        return await connection.save();
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to decline connection request.", error);
      }
    },

    removeConnection: async (
      _: unknown,
      { userId }: { userId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(userId, "User ID", mongoose);
      const pairKey = connectionPairKey(user._id.toString(), userId);
      try {
        const connection = await Connection.findOne({ pairKey, status: "accepted" });
        if (!connection) {
          notFound("No accepted connection exists with that person.");
        }
        await connection.deleteOne();
        return true;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to remove connection.", error);
      }
    },
  },

  Connection: {
    id: (parent: IConnection) => parent._id.toString(),
    requester: (parent: IConnection) => loadUser(parent.requesterId),
    addressee: (parent: IConnection) => loadUser(parent.addresseeId),
    createdAt: (parent: IConnection) => parent.createdAt.toISOString(),
    updatedAt: (parent: IConnection) => parent.updatedAt.toISOString(),
  },
};

export function otherParty(connection: IConnection, viewerId: string): Promise<IUser> {
  const otherId =
    connection.requesterId.toString() === viewerId
      ? connection.addresseeId
      : connection.requesterId;
  return loadUser(otherId);
}
