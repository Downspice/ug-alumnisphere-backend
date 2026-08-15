import mongoose from "mongoose";
import { User, ACCOUNT_STATUSES } from "../models/User.js";
import { Job } from "../models/Job.js";
import { JobApplication } from "../models/JobApplication.js";
import { Event } from "../models/Event.js";
import { EventRegistration } from "../models/EventRegistration.js";
import { Community } from "../models/Community.js";
import { Campaign } from "../models/Campaign.js";
import { Contribution } from "../models/Contribution.js";
import { Report, IReport } from "../models/Report.js";
import { VerificationRequest } from "../models/VerificationRequest.js";
import type { MyContext } from "../types/context.js";
import { requireAdmin } from "../utils/auth.js";
import { assertValidObjectId, badUserInput, internalError, notFound } from "../utils/errors.js";

export const adminResolvers = {
  Query: {
    adminOverview: async (_: unknown, __: unknown, context: MyContext) => {
      requireAdmin(context);
      try {
        const [
          users,
          jobs,
          applications,
          events,
          registrations,
          communities,
          campaigns,
          contributions,
          openReports,
          pendingVerifications,
        ] = await Promise.all([
          User.countDocuments(),
          Job.countDocuments(),
          JobApplication.countDocuments(),
          Event.countDocuments(),
          EventRegistration.countDocuments(),
          Community.countDocuments(),
          Campaign.countDocuments(),
          Contribution.countDocuments({ status: "recorded" }),
          Report.countDocuments({ status: "open" }),
          VerificationRequest.countDocuments({ status: "pending" }),
        ]);
        return {
          users,
          jobs,
          applications,
          events,
          registrations,
          communities,
          campaigns,
          contributions,
          openReports,
          pendingVerifications,
        };
      } catch (error) {
        internalError("Failed to load admin overview.", error);
      }
    },

    adminAnalytics: async (_: unknown, __: unknown, context: MyContext) => {
      requireAdmin(context);
      try {
        const [roleGroups, jobGroups, eventGroups, campaignDocs, monthly] = await Promise.all([
          User.aggregate([{ $group: { _id: "$role", value: { $sum: 1 } } }]),
          Job.aggregate([{ $group: { _id: "$type", value: { $sum: 1 } } }]),
          Event.aggregate([{ $group: { _id: "$status", value: { $sum: 1 } } }]),
          Campaign.find().select("title goalAmount"),
          Contribution.aggregate([
            { $match: { status: "recorded" } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                value: { $sum: "$amount" },
              },
            },
            { $sort: { _id: 1 } },
          ]),
        ]);

        const campaignProgress = await Promise.all(
          campaignDocs.map(async (campaign) => {
            const [sum] = await Contribution.aggregate([
              { $match: { campaignId: campaign._id, status: "recorded" } },
              { $group: { _id: null, value: { $sum: "$amount" } } },
            ]);
            return {
              label: campaign.title,
              value: sum?.value ?? 0,
              goal: campaign.goalAmount,
            };
          })
        );

        return {
          usersByRole: roleGroups.map((item) => ({
            label: item._id === "instructor" ? "alumni" : String(item._id),
            value: item.value,
          })),
          jobsByType: jobGroups.map((item) => ({ label: String(item._id), value: item.value })),
          eventsByStatus: eventGroups.map((item) => ({ label: String(item._id), value: item.value })),
          campaignProgress,
          contributionsByMonth: monthly.map((item) => ({
            label: String(item._id),
            value: item.value,
          })),
          source: "mongodb",
        };
      } catch (error) {
        internalError("Failed to load analytics.", error);
      }
    },

    contentReports: async (
      _: unknown,
      { status }: { status?: string },
      context: MyContext
    ) => {
      requireAdmin(context);
      const filter = status ? { status } : {};
      return Report.find(filter).sort({ createdAt: -1 }).limit(80);
    },
  },

  Mutation: {
    setUserAccountStatus: async (
      _: unknown,
      { id, status }: { id: string; status: string },
      context: MyContext
    ) => {
      const { user } = requireAdmin(context);
      assertValidObjectId(id, "User ID", mongoose);
      if (!ACCOUNT_STATUSES.includes(status as (typeof ACCOUNT_STATUSES)[number])) {
        badUserInput("Account status must be active, suspended, or pending.");
      }
      if (id === user._id.toString()) badUserInput("You cannot change your own account status.");
      const target = await User.findById(id);
      if (!target) notFound("User not found.");
      target.accountStatus = status as (typeof ACCOUNT_STATUSES)[number];
      return target.save();
    },

    reviewReport: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Report ID", mongoose);
      const report = await Report.findById(id);
      if (!report) notFound("Report not found.");
      report.status = "reviewed";
      return report.save();
    },
  },

  ContentReport: {
    id: (parent: IReport) => parent._id.toString(),
    reporter: async (parent: IReport) => User.findById(parent.reporterId),
    createdAt: (parent: IReport) => parent.createdAt.toISOString(),
  },
};
