import mongoose, { Document, Schema, Types } from "mongoose";

export const JOB_TYPES = ["full_time", "part_time", "internship", "contract"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJob extends Document {
  title: string;
  company: string;
  location: string;
  type: JobType;
  industry: string;
  description: string;
  requirements: string;
  applicationUrl?: string;
  postedById: Types.ObjectId;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    company: { type: String, required: true, trim: true, maxlength: 120, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120, index: true },
    type: { type: String, enum: JOB_TYPES, required: true, index: true },
    industry: { type: String, trim: true, maxlength: 80, default: "", index: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    requirements: { type: String, trim: true, maxlength: 3000, default: "" },
    applicationUrl: { type: String, trim: true, maxlength: 500, default: "" },
    postedById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: JOB_STATUSES, default: "open", index: true },
  },
  { timestamps: true }
);

JobSchema.index({ createdAt: -1 });
JobSchema.index({ title: "text", company: "text", description: "text" });

export const Job = mongoose.model<IJob>("Job", JobSchema);
