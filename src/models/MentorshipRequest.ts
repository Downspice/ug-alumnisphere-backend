import mongoose, { Document, Schema, Types } from "mongoose";
import { connectionPairKey } from "./Connection.js";

export const MENTORSHIP_REQUEST_STATUSES = ["pending", "accepted", "declined"] as const;
export type MentorshipRequestStatus = (typeof MENTORSHIP_REQUEST_STATUSES)[number];

export interface IMentorshipRequest extends Document {
  menteeId: Types.ObjectId;
  mentorId: Types.ObjectId;
  pairKey: string;
  message: string;
  status: MentorshipRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MentorshipRequestSchema = new Schema<IMentorshipRequest>(
  {
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pairKey: { type: String, required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: MENTORSHIP_REQUEST_STATUSES, default: "pending", index: true },
  },
  { timestamps: true }
);

MentorshipRequestSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
MentorshipRequestSchema.index({ mentorId: 1, status: 1 });

export const mentorshipPairKey = connectionPairKey;
export const MentorshipRequest = mongoose.model<IMentorshipRequest>(
  "MentorshipRequest",
  MentorshipRequestSchema
);
