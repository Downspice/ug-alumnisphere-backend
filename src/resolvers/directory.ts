import mongoose from "mongoose";
import { User, IUser } from "../models/User.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAuth } from "../utils/auth.js";
import { assertValidObjectId, internalError, notFound } from "../utils/errors.js";

interface DirectoryFilter {
  query?: string;
  graduationYear?: number;
  programme?: string;
  department?: string;
  faculty?: string;
  industry?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  skill?: string;
  openToMentor?: boolean;
  openToWork?: boolean;
  verificationStatus?: string;
}

type DirectorySort = "RECENT" | "NAME_ASC" | "YEAR_DESC";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const directoryResolvers = {
  Query: {
    alumniDirectory: async (
      _: unknown,
      {
        filter,
        sort = "RECENT",
        page = 1,
        pageSize = 12,
      }: {
        filter?: DirectoryFilter;
        sort?: DirectorySort;
        page?: number;
        pageSize?: number;
      },
      context: MyContext
    ) => {
      requireAuth(context);

      const safePage = Math.max(1, page);
      const safeSize = Math.min(24, Math.max(1, pageSize));
      const query: Record<string, unknown> = {
        role: { $in: ["alumni", "student"] },
        accountStatus: "active",
      };

      if (filter?.graduationYear) query.graduationYear = filter.graduationYear;
      if (filter?.programme) {
        query.programme = new RegExp(escapeRegex(filter.programme.trim()), "i");
      }
      if (filter?.department) {
        query.department = new RegExp(escapeRegex(filter.department.trim()), "i");
      }
      if (filter?.faculty) {
        query.faculty = new RegExp(escapeRegex(filter.faculty.trim()), "i");
      }
      if (filter?.industry) {
        query.industry = new RegExp(escapeRegex(filter.industry.trim()), "i");
      }
      if (filter?.company) {
        query.company = new RegExp(escapeRegex(filter.company.trim()), "i");
      }
      if (filter?.jobTitle) {
        query.jobTitle = new RegExp(escapeRegex(filter.jobTitle.trim()), "i");
      }
      if (filter?.location) {
        query.location = new RegExp(escapeRegex(filter.location.trim()), "i");
      }
      if (filter?.skill) {
        query.skills = new RegExp(escapeRegex(filter.skill.trim()), "i");
      }
      if (typeof filter?.openToMentor === "boolean") query.openToMentor = filter.openToMentor;
      if (typeof filter?.openToWork === "boolean") query.openToWork = filter.openToWork;
      if (filter?.verificationStatus) query.verificationStatus = filter.verificationStatus;

      if (filter?.query?.trim()) {
        const term = escapeRegex(filter.query.trim());
        query.$or = [
          { name: new RegExp(term, "i") },
          { headline: new RegExp(term, "i") },
          { company: new RegExp(term, "i") },
          { jobTitle: new RegExp(term, "i") },
          { programme: new RegExp(term, "i") },
        ];
      }

      const sortMap: Record<DirectorySort, Record<string, 1 | -1>> = {
        RECENT: { createdAt: -1 },
        NAME_ASC: { name: 1 },
        YEAR_DESC: { graduationYear: -1, name: 1 },
      };

      try {
        const [items, total] = await Promise.all([
          User.find(query)
            .sort(sortMap[sort] ?? sortMap.RECENT)
            .skip((safePage - 1) * safeSize)
            .limit(safeSize),
          User.countDocuments(query),
        ]);

        return {
          items,
          total,
          page: safePage,
          pageSize: safeSize,
          hasNextPage: safePage * safeSize < total,
        };
      } catch (error) {
        internalError("Failed to search the alumni directory.", error);
      }
    },

    publicProfile: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAuth(context);
      assertValidObjectId(id, "Profile ID", mongoose);
      try {
        const profile = await User.findById(id);
        if (!profile || profile.accountStatus !== "active") {
          notFound("Profile not found.");
        }
        return profile;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to load profile.", error);
      }
    },
  },

  User: {
    email: (parent: IUser & { __selfVisible?: boolean }, _: unknown, context: MyContext) => {
      if (parent.__selfVisible) return parent.email;
      if (!context.user) return "";
      const isSelf = context.user._id.toString() === parent._id.toString();
      const isAdmin = normalizeRole(context.user.role) === "admin";
      return isSelf || isAdmin ? parent.email : "";
    },
  },
};
