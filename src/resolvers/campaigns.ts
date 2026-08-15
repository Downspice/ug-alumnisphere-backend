import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Campaign, ICampaign } from "../models/Campaign.js";
import { Contribution, IContribution } from "../models/Contribution.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAdmin, requireAuth } from "../utils/auth.js";
import { notify } from "../utils/notify.js";
import { assertValidObjectId, badUserInput, forbidden, internalError, notFound } from "../utils/errors.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function campaignTotals(campaignId: mongoose.Types.ObjectId | string) {
  const [summary] = await Contribution.aggregate([
    { $match: { campaignId: new mongoose.Types.ObjectId(String(campaignId)), status: "recorded" } },
    {
      $group: {
        _id: "$campaignId",
        raisedAmount: { $sum: "$amount" },
        contributorCount: { $addToSet: "$contributorId" },
      },
    },
  ]);
  return {
    raisedAmount: summary?.raisedAmount ?? 0,
    contributorCount: summary?.contributorCount?.length ?? 0,
  };
}

export const campaignResolvers = {
  Query: {
    campaigns: async (
      _: unknown,
      { search, includeUnpublished }: { search?: string; includeUnpublished?: boolean },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      const filter: Record<string, unknown> = {};
      if (includeUnpublished) {
        if (normalizeRole(user.role) !== "admin") {
          forbidden("Only administrators can list unpublished campaigns.");
        }
      } else {
        filter.status = { $in: ["active", "closed"] };
      }
      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [{ title: term }, { description: term }];
      }
      try {
        return await Campaign.find(filter).sort({ createdAt: -1 }).limit(80);
      } catch (error) {
        internalError("Failed to load campaigns.", error);
      }
    },

    campaign: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Campaign ID", mongoose);
      const campaign = await Campaign.findById(id);
      if (!campaign) notFound("Campaign not found.");
      if (campaign.status === "draft" && normalizeRole(user.role) !== "admin") {
        forbidden("This campaign is not published.");
      }
      return campaign;
    },

    campaignContributions: async (
      _: unknown,
      { campaignId }: { campaignId: string },
      context: MyContext
    ) => {
      requireAuth(context);
      assertValidObjectId(campaignId, "Campaign ID", mongoose);
      return Contribution.find({ campaignId, status: "recorded" }).sort({ createdAt: -1 }).limit(80);
    },

    myContributions: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Contribution.find({ contributorId: user._id }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load contribution history.", error);
      }
    },
  },

  Mutation: {
    createCampaign: async (
      _: unknown,
      {
        input,
      }: {
        input: { title: string; description: string; goalAmount: number; deadline?: string };
      },
      context: MyContext
    ) => {
      const { user } = requireAdmin(context);
      if (!input.title?.trim() || !input.description?.trim()) {
        badUserInput("Title and description are required.");
      }
      if (!input.goalAmount || input.goalAmount < 1) {
        badUserInput("Goal amount must be at least 1.");
      }
      try {
        return await Campaign.create({
          title: input.title.trim(),
          description: input.description.trim(),
          goalAmount: input.goalAmount,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          status: "draft",
          createdById: user._id,
        });
      } catch (error) {
        internalError("Failed to create campaign.", error);
      }
    },

    updateCampaign: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: { title?: string; description?: string; goalAmount?: number; deadline?: string };
      },
      context: MyContext
    ) => {
      requireAdmin(context);
      assertValidObjectId(id, "Campaign ID", mongoose);
      const campaign = await Campaign.findById(id);
      if (!campaign) notFound("Campaign not found.");
      if (campaign.status === "closed") badUserInput("Closed campaigns cannot be edited.");
      if (input.title?.trim()) campaign.title = input.title.trim();
      if (input.description?.trim()) campaign.description = input.description.trim();
      if (input.goalAmount !== undefined) {
        if (input.goalAmount < 1) badUserInput("Goal amount must be at least 1.");
        campaign.goalAmount = input.goalAmount;
      }
      if (input.deadline) campaign.deadline = new Date(input.deadline);
      return campaign.save();
    },

    publishCampaign: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Campaign ID", mongoose);
      const campaign = await Campaign.findById(id);
      if (!campaign) notFound("Campaign not found.");
      if (campaign.status === "closed") badUserInput("A closed campaign cannot be published.");
      campaign.status = "active";
      return campaign.save();
    },

    closeCampaign: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Campaign ID", mongoose);
      const campaign = await Campaign.findById(id);
      if (!campaign) notFound("Campaign not found.");
      campaign.status = "closed";
      return campaign.save();
    },

    recordContribution: async (
      _: unknown,
      {
        campaignId,
        amount,
        anonymous,
        note,
      }: { campaignId: string; amount: number; anonymous?: boolean; note?: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(campaignId, "Campaign ID", mongoose);
      if (!amount || amount < 1) badUserInput("Amount must be at least 1.");
      if (amount > 1_000_000) badUserInput("Amount is too large for a recorded pledge.");
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) notFound("Campaign not found.");
      if (campaign.status !== "active") badUserInput("This campaign is not accepting records.");
      if (campaign.deadline && campaign.deadline.getTime() < Date.now()) {
        badUserInput("This campaign deadline has passed.");
      }
      try {
        const contribution = await Contribution.create({
          campaignId: campaign._id,
          contributorId: user._id,
          amount,
          anonymous: Boolean(anonymous),
          note: note?.trim() ?? "",
          status: "recorded",
        });
        await notify({
          userId: user._id.toString(),
          title: "Contribution recorded",
          body: `GHS ${amount} was recorded for ${campaign.title}. No payment was taken.`,
          href: `/campaigns/${campaign._id.toString()}`,
        });
        return contribution;
      } catch (error) {
        internalError("Failed to record contribution.", error);
      }
    },
  },

  Campaign: {
    id: (parent: ICampaign) => parent._id.toString(),
    createdBy: async (parent: ICampaign) => User.findById(parent.createdById),
    raisedAmount: async (parent: ICampaign) => (await campaignTotals(parent._id)).raisedAmount,
    contributorCount: async (parent: ICampaign) => (await campaignTotals(parent._id)).contributorCount,
    remainingAmount: async (parent: ICampaign) => {
      const { raisedAmount } = await campaignTotals(parent._id);
      return Math.max(0, parent.goalAmount - raisedAmount);
    },
    progressPercent: async (parent: ICampaign) => {
      const { raisedAmount } = await campaignTotals(parent._id);
      if (parent.goalAmount <= 0) return 0;
      return Math.min(100, Math.round((raisedAmount / parent.goalAmount) * 100));
    },
    deadline: (parent: ICampaign) => parent.deadline?.toISOString() ?? null,
    createdAt: (parent: ICampaign) => parent.createdAt.toISOString(),
  },

  Contribution: {
    id: (parent: IContribution) => parent._id.toString(),
    campaign: async (parent: IContribution) => {
      const campaign = await Campaign.findById(parent.campaignId);
      if (!campaign) notFound("Campaign no longer exists.");
      return campaign;
    },
    contributor: async (parent: IContribution, _: unknown, context: MyContext) => {
      if (!context.user) return null;
      const isSelf = context.user._id.toString() === parent.contributorId.toString();
      const isAdmin = normalizeRole(context.user.role) === "admin";
      if (parent.anonymous && !isSelf && !isAdmin) return null;
      return User.findById(parent.contributorId);
    },
    createdAt: (parent: IContribution) => parent.createdAt.toISOString(),
  },
};
