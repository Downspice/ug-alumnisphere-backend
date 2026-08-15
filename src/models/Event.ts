import mongoose, { Document, Schema, Types } from "mongoose";

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface IEvent extends Document {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt?: Date;
  capacity?: number;
  status: EventStatus;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    location: { type: String, required: true, trim: true, maxlength: 180, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    capacity: { type: Number, min: 1 },
    status: { type: String, enum: EVENT_STATUSES, default: "draft", index: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

EventSchema.index({ status: 1, startsAt: 1 });

export const Event = mongoose.model<IEvent>("Event", EventSchema);
