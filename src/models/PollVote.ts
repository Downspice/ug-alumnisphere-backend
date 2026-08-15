import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPollVote extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  optionIndex: number;
  createdAt: Date;
}

const PollVoteSchema = new Schema<IPollVote>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    optionIndex: { type: Number, required: true, min: 0, max: 3 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PollVoteSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const PollVote = mongoose.model<IPollVote>("PollVote", PollVoteSchema);
