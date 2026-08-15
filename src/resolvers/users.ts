import mongoose from "mongoose";
import { User, IUser, PRODUCT_ROLES, UserRole } from "../models/User.js";
import type { MyContext } from "../types/context.js";
import {
  hashPassword,
  normalizeRole,
  requireAdmin,
  requireAuth,
  validatePasswordStrength,
} from "../utils/auth.js";
import { assertValidObjectId, badUserInput, internalError, notFound } from "../utils/errors.js";
import { claimStoredFile } from "../utils/storage.js";

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

interface UpdateProfileInput {
  name?: string;
  headline?: string;
  about?: string;
  location?: string;
  graduationYear?: number | null;
  programme?: string;
  department?: string;
  faculty?: string;
  industry?: string;
  company?: string;
  jobTitle?: string;
  skills?: string[];
  openToWork?: boolean;
  openToMentor?: boolean;
  avatarFileId?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const userResolvers = {
  Query: {
    users: async (_: unknown, __: unknown, context: MyContext) => {
      requireAdmin(context);
      try {
        return await User.find().sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to fetch users list from database.", error);
      }
    },

    user: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAuth(context);
      assertValidObjectId(id, "User ID", mongoose);
      try {
        const user = await User.findById(id);
        if (!user) {
          notFound(`User not found with ID '${id}'`);
        }
        return user;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError(`Failed to fetch user with ID '${id}'`, error);
      }
    },
  },

  Mutation: {
    createUser: async (
      _: unknown,
      { input }: { input: CreateUserInput },
      context: MyContext
    ) => {
      requireAdmin(context);

      if (!input.name || input.name.trim().length === 0) {
        badUserInput("User name is required.");
      }
      if (!input.email || !EMAIL_PATTERN.test(input.email)) {
        badUserInput("A valid email address is required.");
      }
      const passwordError = validatePasswordStrength(input.password);
      if (passwordError) {
        badUserInput(passwordError);
      }

      const role = input.role ?? "alumni";
      if (!PRODUCT_ROLES.includes(role)) {
        badUserInput("Role must be alumni, student, or admin.");
      }

      try {
        const existing = await User.findOne({ email: input.email.toLowerCase() });
        if (existing) {
          badUserInput(`User with email '${input.email}' already exists.`);
        }
        return await User.create({
          name: input.name.trim(),
          email: input.email.toLowerCase(),
          passwordHash: await hashPassword(input.password),
          role,
        });
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to create user record.", error);
      }
    },

    updateMyProfile: async (
      _: unknown,
      { input }: { input: UpdateProfileInput },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);

      if (input.name !== undefined && input.name.trim().length < 2) {
        badUserInput("Full name must be at least 2 characters.");
      }
      if (
        input.graduationYear !== undefined &&
        input.graduationYear !== null &&
        (input.graduationYear < 1950 || input.graduationYear > 2100)
      ) {
        badUserInput("Graduation year must be between 1950 and 2100.");
      }

      const updates: Record<string, unknown> = {};
      const assignable: Array<keyof UpdateProfileInput> = [
        "name",
        "headline",
        "about",
        "location",
        "graduationYear",
        "programme",
        "department",
        "faculty",
        "industry",
        "company",
        "jobTitle",
        "skills",
        "openToWork",
        "openToMentor",
      ];

      for (const key of assignable) {
        if (input[key] !== undefined) {
          updates[key] = typeof input[key] === "string" ? String(input[key]).trim() : input[key];
        }
      }

      if (input.avatarFileId) {
        const file = await claimStoredFile(input.avatarFileId, user._id.toString(), "avatar");
        updates.avatarUrl = file.publicUrl || `/files/${file._id.toString()}`;
        updates.avatarPath = file.path;
      }

      try {
        const updated = await User.findByIdAndUpdate(
          user._id,
          { $set: updates },
          { new: true, runValidators: true }
        );
        if (!updated) {
          notFound("User profile could not be updated.");
        }
        return updated;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to update profile.", error);
      }
    },
  },

  User: {
    id: (parent: IUser) => parent._id.toString(),
    role: (parent: IUser) => normalizeRole(parent.role),
    skills: (parent: IUser) => parent.skills ?? [],
    openToWork: (parent: IUser) => Boolean(parent.openToWork),
    openToMentor: (parent: IUser) => Boolean(parent.openToMentor),
    createdAt: (parent: IUser) =>
      parent.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: (parent: IUser) =>
      parent.updatedAt?.toISOString?.() || new Date().toISOString(),
  },
};
