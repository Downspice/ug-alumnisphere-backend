import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Community, ICommunity, slugify } from "../models/Community.js";
import { CommunityMember, ICommunityMember } from "../models/CommunityMember.js";
import {
  CommunityJoinRequest,
  ICommunityJoinRequest,
} from "../models/CommunityJoinRequest.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAuth } from "../utils/auth.js";
import {
  assertValidObjectId,
  badUserInput,
  forbidden,
  internalError,
  notFound,
} from "../utils/errors.js";

async function membership(communityId: string, userId: string) {
  return CommunityMember.findOne({ communityId, userId });
}

async function requireMember(communityId: string, userId: string) {
  const member = await membership(communityId, userId);
  if (!member) forbidden("You are not a member of this community.");
  return member;
}

async function requireModerator(communityId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const member = await membership(communityId, userId);
    return member;
  }
  const member = await requireMember(communityId, userId);
  if (member.role === "member") {
    forbidden("Only owners and moderators can do this.");
  }
  return member;
}

export const communityResolvers = {
  Query: {
    communities: async (
      _: unknown,
      { search, mine }: { search?: string; mine?: boolean },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      try {
        const filter: Record<string, unknown> = {};
        if (search?.trim()) {
          filter.name = new RegExp(
            search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          );
        }
        if (mine) {
          const mineIds = await CommunityMember.find({ userId: user._id }).distinct(
            "communityId"
          );
          filter._id = { $in: mineIds };
        } else {
          filter.$or = [
            { isPrivate: false },
            {
              _id: {
                $in: await CommunityMember.find({ userId: user._id }).distinct(
                  "communityId"
                ),
              },
            },
          ];
        }
        return await Community.find(filter).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load communities.", error);
      }
    },

    community: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Community ID", mongoose);
      const community = await Community.findById(id);
      if (!community) notFound("Community not found.");
      if (community.isPrivate) {
        const member = await membership(id, user._id.toString());
        if (!member && normalizeRole(user.role) !== "admin") {
          return community;
        }
      }
      return community;
    },

    communityMembers: async (
      _: unknown,
      { communityId }: { communityId: string },
      context: MyContext
    ) => {
      requireAuth(context);
      assertValidObjectId(communityId, "Community ID", mongoose);
      return CommunityMember.find({ communityId }).sort({ createdAt: 1 });
    },

    communityJoinRequests: async (
      _: unknown,
      { communityId }: { communityId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(communityId, "Community ID", mongoose);
      await requireModerator(
        communityId,
        user._id.toString(),
        normalizeRole(user.role) === "admin"
      );
      return CommunityJoinRequest.find({ communityId, status: "pending" }).sort({
        createdAt: -1,
      });
    },
  },

  Mutation: {
    createCommunity: async (
      _: unknown,
      { input }: { input: { name: string; description?: string; isPrivate?: boolean } },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      const name = input.name?.trim();
      if (!name || name.length < 3)
        badUserInput("Community name must be at least 3 characters.");
      let slug = slugify(name);
      if (!slug) badUserInput("Community name must include letters or numbers.");
      const clash = await Community.findOne({ slug });
      if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;
      try {
        const community = await Community.create({
          name,
          slug,
          description: input.description?.trim() ?? "",
          isPrivate: Boolean(input.isPrivate),
          ownerId: user._id,
          memberCount: 1,
        });
        await CommunityMember.create({
          communityId: community._id,
          userId: user._id,
          role: "owner",
        });
        return community;
      } catch (error) {
        internalError("Failed to create community.", error);
      }
    },

    updateCommunity: async (
      _: unknown,
      { id, input }: { id: string; input: { name?: string; description?: string } },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Community ID", mongoose);
      const community = await Community.findById(id);
      if (!community) notFound("Community not found.");
      const member = await membership(id, user._id.toString());
      if (member?.role !== "owner" && normalizeRole(user.role) !== "admin") {
        forbidden("Only the owner can update this community.");
      }
      if (input.name?.trim()) community.name = input.name.trim();
      if (input.description !== undefined)
        community.description = input.description.trim();
      return community.save();
    },

    joinCommunity: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Community ID", mongoose);
      const community = await Community.findById(id);
      if (!community) notFound("Community not found.");
      const existing = await membership(id, user._id.toString());
      if (existing) badUserInput("You are already a member.");
      if (community.isPrivate) {
        const pending = await CommunityJoinRequest.findOne({
          communityId: id,
          userId: user._id,
          status: "pending",
        });
        if (pending) badUserInput("A join request is already pending.");
        await CommunityJoinRequest.create({
          communityId: community._id,
          userId: user._id,
          status: "pending",
        });
        return community;
      }
      try {
        await CommunityMember.create({
          communityId: community._id,
          userId: user._id,
          role: "member",
        });
        community.memberCount += 1;
        return community.save();
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("You are already a member.");
        }
        internalError("Failed to join community.", error);
      }
    },

    leaveCommunity: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Community ID", mongoose);
      const member = await membership(id, user._id.toString());
      if (!member) badUserInput("You are not a member of this community.");
      if (member.role === "owner") {
        forbidden(
          "Owners cannot leave. Transfer ownership or archive the community first."
        );
      }
      await member.deleteOne();
      await Community.findByIdAndUpdate(id, { $inc: { memberCount: -1 } });
      return true;
    },

    reviewJoinRequest: async (
      _: unknown,
      { id, approve }: { id: string; approve: boolean },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Join request ID", mongoose);
      const request = await CommunityJoinRequest.findById(id);
      if (!request) notFound("Join request not found.");
      await requireModerator(
        request.communityId.toString(),
        user._id.toString(),
        normalizeRole(user.role) === "admin"
      );
      if (request.status !== "pending")
        badUserInput("This request is no longer pending.");
      request.status = approve ? "approved" : "rejected";
      await request.save();
      if (approve) {
        const already = await membership(
          request.communityId.toString(),
          request.userId.toString()
        );
        if (!already) {
          await CommunityMember.create({
            communityId: request.communityId,
            userId: request.userId,
            role: "member",
          });
          await Community.findByIdAndUpdate(request.communityId, {
            $inc: { memberCount: 1 },
          });
        }
      }
      return request;
    },

    assignModerator: async (
      _: unknown,
      {
        communityId,
        userId,
        makeModerator,
      }: { communityId: string; userId: string; makeModerator: boolean },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(communityId, "Community ID", mongoose);
      assertValidObjectId(userId, "User ID", mongoose);
      const actor = await membership(communityId, user._id.toString());
      if (actor?.role !== "owner" && normalizeRole(user.role) !== "admin") {
        forbidden("Only the owner can assign moderators.");
      }
      const target = await membership(communityId, userId);
      if (!target) notFound("That person is not a member.");
      if (target.role === "owner")
        badUserInput("The owner role cannot be changed this way.");
      target.role = makeModerator ? "moderator" : "member";
      return target.save();
    },
  },

  Community: {
    id: (parent: ICommunity) => parent._id.toString(),
    owner: async (parent: ICommunity) => User.findById(parent.ownerId),
    myRole: async (parent: ICommunity, _: unknown, context: MyContext) => {
      if (!context.user) return null;
      const member = await membership(parent._id.toString(), context.user._id.toString());
      return member?.role ?? null;
    },
    joinRequestPending: async (parent: ICommunity, _: unknown, context: MyContext) => {
      if (!context.user) return false;
      const request = await CommunityJoinRequest.findOne({
        communityId: parent._id,
        userId: context.user._id,
        status: "pending",
      });
      return Boolean(request);
    },
    createdAt: (parent: ICommunity) => parent.createdAt.toISOString(),
  },

  CommunityMember: {
    id: (parent: ICommunityMember) => parent._id.toString(),
    user: async (parent: ICommunityMember) => User.findById(parent.userId),
    createdAt: (parent: ICommunityMember) => parent.createdAt.toISOString(),
  },

  CommunityJoinRequest: {
    id: (parent: ICommunityJoinRequest) => parent._id.toString(),
    user: async (parent: ICommunityJoinRequest) => User.findById(parent.userId),
    createdAt: (parent: ICommunityJoinRequest) => parent.createdAt.toISOString(),
  },
};
