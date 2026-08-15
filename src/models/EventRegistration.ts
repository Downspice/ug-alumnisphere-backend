import mongoose, { Document, Schema, Types } from "mongoose";

export interface IEventRegistration extends Document {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const EventRegistrationSchema = new Schema<IEventRegistration>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
EventRegistrationSchema.index({ userId: 1, createdAt: -1 });

export const EventRegistration = mongoose.model<IEventRegistration>(
  "EventRegistration",
  EventRegistrationSchema
);
