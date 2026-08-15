import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICommunityJoinRequest extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const CommunityJoinRequestSchema = new Schema<ICommunityJoinRequest>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: "Community", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

CommunityJoinRequestSchema.index({ communityId: 1, userId: 1, status: 1 });
CommunityJoinRequestSchema.index(
  { communityId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export const CommunityJoinRequest = mongoose.model<ICommunityJoinRequest>(
  "CommunityJoinRequest",
  CommunityJoinRequestSchema
);
