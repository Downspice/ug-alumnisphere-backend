import mongoose, { Document, Schema, Types } from "mongoose";

export const APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "shortlisted",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface IJobApplication extends Document {
  jobId: Types.ObjectId;
  applicantId: Types.ObjectId;
  coverNote: string;
  resumeFileName?: string;
  resumePath?: string;
  resumeFileId?: Types.ObjectId;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coverNote: { type: String, required: true, trim: true, maxlength: 2000 },
    resumeFileName: { type: String, trim: true, maxlength: 180, default: "" },
    resumePath: { type: String, default: "" },
    resumeFileId: { type: Schema.Types.ObjectId, ref: "StoredFile" },
    status: { type: String, enum: APPLICATION_STATUSES, default: "submitted", index: true },
  },
  { timestamps: true }
);

JobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
JobApplicationSchema.index({ applicantId: 1, createdAt: -1 });
JobApplicationSchema.index({ jobId: 1, status: 1 });

export const JobApplication = mongoose.model<IJobApplication>("JobApplication", JobApplicationSchema);
