import mongoose, { Document, Schema } from "mongoose";

export const PRODUCT_ROLES = ["alumni", "student", "admin"] as const;
export type UserRole = (typeof PRODUCT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended", "pending"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole | "instructor";
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  verificationRejectionReason?: string;
  headline?: string;
  about?: string;
  location?: string;
  graduationYear?: number;
  programme?: string;
  department?: string;
  faculty?: string;
  industry?: string;
  company?: string;
  jobTitle?: string;
  skills: string[];
  openToWork: boolean;
  openToMentor: boolean;
  avatarUrl?: string;
  avatarPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: [...PRODUCT_ROLES, "instructor"],
      default: "alumni",
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: "active",
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "unverified",
      index: true,
    },
    verificationRejectionReason: { type: String, default: "" },
    headline: { type: String, trim: true, maxlength: 160, default: "" },
    about: { type: String, trim: true, maxlength: 2000, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "", index: true },
    graduationYear: { type: Number, min: 1950, max: 2100, index: true },
    programme: { type: String, trim: true, maxlength: 160, default: "", index: true },
    department: { type: String, trim: true, maxlength: 160, default: "", index: true },
    faculty: { type: String, trim: true, maxlength: 160, default: "" },
    industry: { type: String, trim: true, maxlength: 120, default: "", index: true },
    company: { type: String, trim: true, maxlength: 160, default: "", index: true },
    jobTitle: { type: String, trim: true, maxlength: 160, default: "" },
    skills: { type: [String], default: [], index: true },
    openToWork: { type: Boolean, default: false, index: true },
    openToMentor: { type: Boolean, default: false, index: true },
    avatarUrl: { type: String, default: "" },
    avatarPath: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ name: "text", headline: "text", company: "text", jobTitle: "text" });
UserSchema.index({ role: 1, accountStatus: 1, graduationYear: 1, programme: 1 });
UserSchema.index({ role: 1, industry: 1, location: 1, openToMentor: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
