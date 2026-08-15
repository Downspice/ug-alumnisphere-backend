import mongoose, { Document, Schema, Types } from "mongoose";

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: "post" | "comment";
  targetId: Types.ObjectId;
  reason: string;
  status: "open" | "reviewed";
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 400 },
    status: { type: String, enum: ["open", "reviewed"], default: "open", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ReportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });

export const Report = mongoose.model<IReport>("Report", ReportSchema);
