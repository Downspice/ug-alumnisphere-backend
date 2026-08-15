import mongoose from "mongoose";
import { Notification, INotification } from "../models/Notification.js";
import type { MyContext } from "../types/context.js";
import { requireAuth } from "../utils/auth.js";
import { assertValidObjectId, forbidden, internalError, notFound } from "../utils/errors.js";

export const notificationResolvers = {
  Query: {
    notifications: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Notification.find({ userId: user._id }).sort({ createdAt: -1 }).limit(80);
      } catch (error) {
        internalError("Failed to load notifications.", error);
      }
    },

    unreadNotificationCount: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      return Notification.countDocuments({ userId: user._id, read: false });
    },
  },

  Mutation: {
    markNotificationRead: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Notification ID", mongoose);
      const item = await Notification.findById(id);
      if (!item) notFound("Notification not found.");
      if (item.userId.toString() !== user._id.toString()) {
        forbidden("You can only mark your own notifications.");
      }
      item.read = true;
      return item.save();
    },

    markAllNotificationsRead: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      await Notification.updateMany({ userId: user._id, read: false }, { $set: { read: true } });
      return true;
    },
  },

  Notification: {
    id: (parent: INotification) => parent._id.toString(),
    createdAt: (parent: INotification) => parent.createdAt.toISOString(),
  },
};
