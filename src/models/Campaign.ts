import mongoose, { Document, Schema, Types } from "mongoose";

export const CAMPAIGN_STATUSES = ["draft", "active", "closed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface ICampaign extends Document {
  title: string;
  description: string;
  goalAmount: number;
  deadline?: Date;
  status: CampaignStatus;
  createdById: Types.ObjectId;
  coverImageUrl?: string;
  coverImagePath?: string;
  coverFileId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    goalAmount: { type: Number, required: true, min: 1 },
    deadline: { type: Date },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "draft", index: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coverImageUrl: { type: String, default: "" },
    coverImagePath: { type: String, default: "" },
    coverFileId: { type: Schema.Types.ObjectId, ref: "StoredFile" },
  },
  { timestamps: true }
);

CampaignSchema.index({ status: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaign>("Campaign", CampaignSchema);
