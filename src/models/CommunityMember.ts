import mongoose, { Document, Schema, Types } from "mongoose";

export const COMMUNITY_ROLES = ["owner", "moderator", "member"] as const;
export type CommunityRole = (typeof COMMUNITY_ROLES)[number];

export interface ICommunityMember extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CommunityRole;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityMemberSchema = new Schema<ICommunityMember>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: "Community", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: COMMUNITY_ROLES, default: "member" },
  },
  { timestamps: true }
);

CommunityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
CommunityMemberSchema.index({ userId: 1 });

export const CommunityMember = mongoose.model<ICommunityMember>(
  "CommunityMember",
  CommunityMemberSchema
);
