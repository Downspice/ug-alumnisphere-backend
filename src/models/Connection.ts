import mongoose, { Document, Schema, Types } from "mongoose";

export const CONNECTION_STATUSES = ["pending", "accepted", "declined"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface IConnection extends Document {
  requesterId: Types.ObjectId;
  addresseeId: Types.ObjectId;
  pairKey: string;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function connectionPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

const ConnectionSchema = new Schema<IConnection>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addresseeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pairKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: CONNECTION_STATUSES,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

ConnectionSchema.index({ addresseeId: 1, status: 1 });
ConnectionSchema.index({ requesterId: 1, status: 1 });

export const Connection = mongoose.model<IConnection>("Connection", ConnectionSchema);
