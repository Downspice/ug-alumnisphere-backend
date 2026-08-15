import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Connection, connectionPairKey } from "../models/Connection.js";
import { Conversation, IConversation } from "../models/Conversation.js";
import { Message, IMessage } from "../models/Message.js";
import type { MyContext } from "../types/context.js";
import { requireAuth } from "../utils/auth.js";
import {
  assertValidObjectId,
  badUserInput,
  forbidden,
  internalError,
  notFound,
} from "../utils/errors.js";

function unreadFor(conversation: IConversation, userId: string): number {
  return conversation.unread?.get(userId) ?? 0;
}

async function assertParticipant(conversationId: string, userId: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) notFound("Conversation not found.");
  if (!conversation.participantIds.some((id) => id.toString() === userId)) {
    forbidden("You are not part of this conversation.");
  }
  return conversation;
}

export const messagingResolvers = {
  Query: {
    conversations: async (
      _: unknown,
      { search }: { search?: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      try {
        let items = await Conversation.find({ participantIds: user._id }).sort({
          lastMessageAt: -1,
        });
        if (search?.trim()) {
          const term = search.trim().toLowerCase();
          const others = items
            .map((item) =>
              item.participantIds.find((id) => id.toString() !== user._id.toString())
            )
            .filter(Boolean);
          const matches = await User.find({
            _id: { $in: others },
            name: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          }).select("_id");
          const allowed = new Set(matches.map((item) => item._id.toString()));
          items = items.filter((item) => {
            const other = item.participantIds.find(
              (id) => id.toString() !== user._id.toString()
            );
            return (
              item.lastMessagePreview.toLowerCase().includes(term) ||
              (other && allowed.has(other.toString()))
            );
          });
        }
        return items;
      } catch (error) {
        internalError("Failed to load conversations.", error);
      }
    },

    conversation: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Conversation ID", mongoose);
      return assertParticipant(id, user._id.toString());
    },

    messages: async (
      _: unknown,
      { conversationId }: { conversationId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(conversationId, "Conversation ID", mongoose);
      await assertParticipant(conversationId, user._id.toString());
      try {
        return await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(200);
      } catch (error) {
        internalError("Failed to load messages.", error);
      }
    },
  },

  Mutation: {
    startConversation: async (
      _: unknown,
      { userId }: { userId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(userId, "User ID", mongoose);
      if (userId === user._id.toString()) {
        badUserInput("You cannot message yourself.");
      }
      const pairKey = connectionPairKey(user._id.toString(), userId);
      const connected = await Connection.findOne({ pairKey, status: "accepted" });
      if (!connected) {
        forbidden("You can only message people you are connected with.");
      }
      const existing = await Conversation.findOne({ pairKey });
      if (existing) return existing;
      try {
        return await Conversation.create({
          pairKey,
          participantIds: [user._id, userId],
          lastMessagePreview: "",
          unread: {},
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          const again = await Conversation.findOne({ pairKey });
          if (!again) notFound("Conversation not found after create.");
          return again;
        }
        internalError("Failed to start conversation.", error);
      }
    },

    sendMessage: async (
      _: unknown,
      { conversationId, body }: { conversationId: string; body: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(conversationId, "Conversation ID", mongoose);
      const text = body?.trim();
      if (!text) badUserInput("Message cannot be empty.");
      const conversation = await assertParticipant(conversationId, user._id.toString());
      try {
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: user._id,
          body: text,
        });
        const other = conversation.participantIds.find(
          (id) => id.toString() !== user._id.toString()
        );
        if (other) {
          const current = conversation.unread.get(other.toString()) ?? 0;
          conversation.unread.set(other.toString(), current + 1);
        }
        conversation.unread.set(user._id.toString(), 0);
        conversation.lastMessageAt = new Date();
        conversation.lastMessagePreview = text.slice(0, 140);
        await conversation.save();
        return message;
      } catch (error) {
        internalError("Failed to send message.", error);
      }
    },

    markConversationRead: async (
      _: unknown,
      { conversationId }: { conversationId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(conversationId, "Conversation ID", mongoose);
      const conversation = await assertParticipant(conversationId, user._id.toString());
      conversation.unread.set(user._id.toString(), 0);
      await conversation.save();
      return conversation;
    },
  },

  Conversation: {
    id: (parent: IConversation) => parent._id.toString(),
    participants: async (parent: IConversation) => {
      return User.find({ _id: { $in: parent.participantIds } });
    },
    unreadCount: (parent: IConversation, _: unknown, context: MyContext) => {
      if (!context.user) return 0;
      return unreadFor(parent, context.user._id.toString());
    },
    lastMessageAt: (parent: IConversation) => parent.lastMessageAt.toISOString(),
  },

  Message: {
    id: (parent: IMessage) => parent._id.toString(),
    sender: async (parent: IMessage) => {
      const sender = await User.findById(parent.senderId);
      if (!sender) notFound("Message sender no longer exists.");
      return sender;
    },
    createdAt: (parent: IMessage) => parent.createdAt.toISOString(),
  },
};
