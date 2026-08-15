import mongoose from "mongoose";
import { User } from "../models/User.js";
import { VerificationRequest, IVerificationRequest } from "../models/VerificationRequest.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAdmin, requireAuth } from "../utils/auth.js";
import { assertValidObjectId, badUserInput, forbidden, internalError, notFound } from "../utils/errors.js";
import { notify } from "../utils/notify.js";
import { claimStoredFile } from "../utils/storage.js";

interface SubmitVerificationInput {
  graduationYear: number;
  programme: string;
  studentNumber: string;
  notes?: string;
  documentFileName?: string;
  documentFileId?: string;
}

export const verificationResolvers = {
  Query: {
    myVerificationRequest: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await VerificationRequest.findOne({ applicantId: user._id }).sort({
          createdAt: -1,
        });
      } catch (error) {
        internalError("Failed to load verification request.", error);
      }
    },

    verificationRequests: async (
      _: unknown,
      { status }: { status?: string },
      context: MyContext
    ) => {
      requireAdmin(context);
      try {
        const filter = status ? { status } : {};
        return await VerificationRequest.find(filter).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load verification requests.", error);
      }
    },
  },

  Mutation: {
    submitVerification: async (
      _: unknown,
      { input }: { input: SubmitVerificationInput },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      if (normalizeRole(user.role) !== "alumni") {
        forbidden("Only alumni can submit verification requests.");
      }
      if (user.verificationStatus === "verified") {
        badUserInput("This account is already verified.");
      }
      if (user.verificationStatus === "pending") {
        badUserInput("A verification request is already under review.");
      }
      if (!input.programme?.trim() || !input.studentNumber?.trim()) {
        badUserInput("Programme and student number are required.");
      }
      if (input.graduationYear < 1950 || input.graduationYear > 2100) {
        badUserInput("Graduation year must be between 1950 and 2100.");
      }

      const document = input.documentFileId
        ? await claimStoredFile(input.documentFileId, user._id.toString(), "verification")
        : null;

      try {
        const request = await VerificationRequest.create({
          applicantId: user._id,
          graduationYear: input.graduationYear,
          programme: input.programme.trim(),
          studentNumber: input.studentNumber.trim(),
          notes: input.notes?.trim() ?? "",
          documentFileName: document?.originalName ?? input.documentFileName?.trim() ?? "",
          documentPath: document?.path ?? "",
          documentFileId: document?._id,
          status: "pending",
        });

        await User.findByIdAndUpdate(user._id, {
          $set: {
            verificationStatus: "pending",
            verificationRejectionReason: "",
            graduationYear: input.graduationYear,
            programme: input.programme.trim(),
          },
        });

        return request;
      } catch (error) {
        internalError("Failed to submit verification request.", error);
      }
    },

    reviewVerification: async (
      _: unknown,
      { id, approve, rejectionReason }: { id: string; approve: boolean; rejectionReason?: string },
      context: MyContext
    ) => {
      const admin = requireAdmin(context);
      assertValidObjectId(id, "Verification request ID", mongoose);

      if (!approve && !rejectionReason?.trim()) {
        badUserInput("A rejection reason is required.");
      }

      try {
        const request = await VerificationRequest.findById(id);
        if (!request) {
          notFound("Verification request not found.");
        }
        if (request.status !== "pending") {
          badUserInput("Only pending requests can be reviewed.");
        }

        request.status = approve ? "verified" : "rejected";
        request.rejectionReason = approve ? "" : rejectionReason!.trim();
        request.reviewedById = admin.user._id as mongoose.Types.ObjectId;
        request.reviewedAt = new Date();
        await request.save();

        await User.findByIdAndUpdate(request.applicantId, {
          $set: {
            verificationStatus: request.status,
            verificationRejectionReason: request.rejectionReason,
          },
        });

        await notify({
          userId: request.applicantId.toString(),
          title: approve ? "Verification approved" : "Verification rejected",
          body: approve
            ? "An administrator confirmed your alumni verification."
            : request.rejectionReason || "Your verification request was rejected.",
          href: "/profile",
        });

        return request;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to review verification request.", error);
      }
    },
  },

  VerificationRequest: {
    id: (parent: IVerificationRequest) => parent._id.toString(),
    applicant: async (parent: IVerificationRequest) => {
      const applicant = await User.findById(parent.applicantId);
      if (!applicant) {
        notFound("Applicant no longer exists.");
      }
      return applicant;
    },
    reviewedBy: async (parent: IVerificationRequest) => {
      if (!parent.reviewedById) return null;
      return User.findById(parent.reviewedById);
    },
    createdAt: (parent: IVerificationRequest) => parent.createdAt.toISOString(),
    reviewedAt: (parent: IVerificationRequest) => parent.reviewedAt?.toISOString() ?? null,
    documentDownloadUrl: (parent: IVerificationRequest) =>
      parent.documentFileId ? `/files/${parent.documentFileId.toString()}` : null,
  },
};
