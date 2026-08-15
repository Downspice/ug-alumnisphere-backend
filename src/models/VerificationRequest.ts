import mongoose, { Document, Schema, Types } from "mongoose";
import type { VerificationStatus } from "./User.js";

export interface IVerificationRequest extends Document {
  applicantId: Types.ObjectId;
  graduationYear: number;
  programme: string;
  studentNumber: string;
  notes: string;
  documentPath?: string;
  documentFileName?: string;
  documentFileId?: Types.ObjectId;
  status: VerificationStatus;
  rejectionReason: string;
  reviewedById?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    graduationYear: { type: Number, required: true, min: 1950, max: 2100 },
    programme: { type: String, required: true, trim: true, maxlength: 160 },
    studentNumber: { type: String, required: true, trim: true, maxlength: 40 },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    documentPath: { type: String, default: "" },
    documentFileName: { type: String, default: "" },
    documentFileId: { type: Schema.Types.ObjectId, ref: "StoredFile" },
    status: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

VerificationRequestSchema.index({ applicantId: 1, createdAt: -1 });
VerificationRequestSchema.index({ status: 1, createdAt: -1 });

export const VerificationRequest = mongoose.model<IVerificationRequest>(
  "VerificationRequest",
  VerificationRequestSchema
);
