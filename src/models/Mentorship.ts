import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMentorshipGoal {
  _id: Types.ObjectId;
  text: string;
  done: boolean;
}

export interface IMentorship extends Document {
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  pairKey: string;
  status: "active" | "closed";
  goals: IMentorshipGoal[];
  createdAt: Date;
  updatedAt: Date;
}

const MentorshipSchema = new Schema<IMentorship>(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
    goals: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 200 },
          done: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Mentorship = mongoose.model<IMentorship>("Mentorship", MentorshipSchema);
