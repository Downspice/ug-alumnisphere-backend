import mongoose, { Document, Schema, Types } from "mongoose";
import { connectionPairKey } from "./Connection.js";

export interface IConversation extends Document {
  pairKey: string;
  participantIds: Types.ObjectId[];
  lastMessageAt: Date;
  lastMessagePreview: string;
  unread: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    pairKey: { type: String, required: true, unique: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: "" },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

ConversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export const conversationPairKey = connectionPairKey;
export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema);
