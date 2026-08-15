import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICommunity extends Document {
  name: string;
  slug: string;
  description: string;
  isPrivate: boolean;
  ownerId: Types.ObjectId;
  memberCount: number;
  coverImageUrl?: string;
  coverImagePath?: string;
  coverFileId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    isPrivate: { type: Boolean, default: false, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    memberCount: { type: Number, default: 1 },
    coverImageUrl: { type: String, default: "" },
    coverImagePath: { type: String, default: "" },
    coverFileId: { type: Schema.Types.ObjectId, ref: "StoredFile" },
  },
  { timestamps: true }
);

CommunitySchema.index({ name: "text", description: "text" });

export const Community = mongoose.model<ICommunity>("Community", CommunitySchema);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
