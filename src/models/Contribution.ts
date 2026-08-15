import mongoose, { Document, Schema, Types } from "mongoose";

export interface IContribution extends Document {
  campaignId: Types.ObjectId;
  contributorId: Types.ObjectId;
  amount: number;
  anonymous: boolean;
  note: string;
  status: "recorded";
  createdAt: Date;
}

const ContributionSchema = new Schema<IContribution>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    contributorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1, max: 1_000_000 },
    anonymous: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 400, default: "" },
    status: { type: String, enum: ["recorded"], default: "recorded" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ContributionSchema.index({ campaignId: 1, createdAt: -1 });

export const Contribution = mongoose.model<IContribution>(
  "Contribution",
  ContributionSchema
);
