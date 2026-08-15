import mongoose, { Document, Schema, Types } from "mongoose";

export const FILE_PURPOSES = [
  "avatar",
  "post",
  "verification",
  "resume",
  "event",
  "campaign",
  "community",
] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export interface IStoredFile extends Document {
  ownerId: Types.ObjectId;
  purpose: FilePurpose;
  bucket: string;
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: "public" | "private";
  publicUrl?: string;
  claimed: boolean;
  createdAt: Date;
}

const StoredFileSchema = new Schema<IStoredFile>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: FILE_PURPOSES, required: true, index: true },
    bucket: { type: String, required: true },
    path: { type: String, required: true },
    originalName: { type: String, required: true, trim: true, maxlength: 180 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    size: { type: Number, required: true, min: 1 },
    visibility: { type: String, enum: ["public", "private"], required: true },
    publicUrl: { type: String, default: "" },
    claimed: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StoredFileSchema.index({ bucket: 1, path: 1 }, { unique: true });

export const StoredFile = mongoose.model<IStoredFile>("StoredFile", StoredFileSchema);
