import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISavedJob extends Document {
  jobId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const SavedJobSchema = new Schema<ISavedJob>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SavedJobSchema.index({ jobId: 1, userId: 1 }, { unique: true });
SavedJobSchema.index({ userId: 1, createdAt: -1 });

export const SavedJob = mongoose.model<ISavedJob>("SavedJob", SavedJobSchema);
