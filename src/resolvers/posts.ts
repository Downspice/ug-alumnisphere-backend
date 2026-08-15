import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Community } from "../models/Community.js";
import { CommunityMember } from "../models/CommunityMember.js";
import { Post, IPost, POST_TYPES } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { Comment, IComment } from "../models/Comment.js";
import { SavedPost } from "../models/SavedPost.js";
import { Report } from "../models/Report.js";
import { PollVote } from "../models/PollVote.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAuth } from "../utils/auth.js";
import { assertValidObjectId, badUserInput, forbidden, internalError, notFound } from "../utils/errors.js";
import { claimStoredFile } from "../utils/storage.js";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function canAccessCommunity(communityId: string | undefined, userId: string, isAdmin: boolean) {
  if (!communityId) return true;
  const community = await Community.findById(communityId);
  if (!community) notFound("Community not found.");
  if (!community.isPrivate || isAdmin) return true;
  const member = await CommunityMember.findOne({ communityId, userId });
  if (!member) forbidden("This community is private.");
  return true;
}

async function requirePostAccess(post: IPost, userId: string, isAdmin: boolean) {
  await canAccessCommunity(post.communityId?.toString(), userId, isAdmin);
}

function pollClosed(post: IPost) {
  return Boolean(post.pollClosesAt && post.pollClosesAt.getTime() <= Date.now());
}

export const postResolvers = {
  Query: {
    feed: async (
      _: unknown,
      { communityId }: { communityId?: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      const isAdmin = normalizeRole(user.role) === "admin";
      if (communityId) {
        assertValidObjectId(communityId, "Community ID", mongoose);
        await canAccessCommunity(communityId, user._id.toString(), isAdmin);
      }
      try {
        const filter = communityId ? { communityId } : { communityId: { $exists: false } };
        return await Post.find(filter).sort({ createdAt: -1 }).limit(80);
      } catch (error) {
        internalError("Failed to load the feed.", error);
      }
    },

    post: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Post ID", mongoose);
      const post = await Post.findById(id);
      if (!post) notFound("Post not found.");
      await requirePostAccess(post, user._id.toString(), normalizeRole(user.role) === "admin");
      return post;
    },

    comments: async (_: unknown, { postId }: { postId: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(postId, "Post ID", mongoose);
      const post = await Post.findById(postId);
      if (!post) notFound("Post not found.");
      await requirePostAccess(post, user._id.toString(), normalizeRole(user.role) === "admin");
      return Comment.find({ postId }).sort({ createdAt: 1 });
    },

    savedPosts: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      const saved = await SavedPost.find({ userId: user._id }).sort({ createdAt: -1 });
      const posts = await Post.find({ _id: { $in: saved.map((item) => item.postId) } });
      const byId = new Map(posts.map((post) => [post._id.toString(), post]));
      return saved.map((item) => byId.get(item.postId.toString())).filter(Boolean);
    },
  },

  Mutation: {
    createPost: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          communityId?: string;
          type: string;
          body?: string;
          linkUrl?: string;
          pollQuestion?: string;
          pollOptions?: string[];
          pollClosesAt?: string;
          imageFileId?: string;
        };
      },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      if (!POST_TYPES.includes(input.type as (typeof POST_TYPES)[number])) {
        badUserInput("Post type must be text, link, poll, or image.");
      }
      if (input.communityId) {
        assertValidObjectId(input.communityId, "Community ID", mongoose);
        const member = await CommunityMember.findOne({
          communityId: input.communityId,
          userId: user._id,
        });
        if (!member && normalizeRole(user.role) !== "admin") {
          forbidden("Join the community before posting.");
        }
      }
      const payload: Record<string, unknown> = {
        authorId: user._id,
        type: input.type,
        body: input.body?.trim() ?? "",
      };
      if (input.communityId) payload.communityId = input.communityId;
      if (input.type === "text" && !String(payload.body)) {
        badUserInput("Write something before posting.");
      }
      if (input.type === "link") {
        const url = input.linkUrl?.trim() ?? "";
        if (!isValidHttpUrl(url)) badUserInput("Enter a valid http(s) link.");
        payload.linkUrl = url;
        if (!payload.body) payload.body = url;
      }
      if (input.type === "image") {
        if (!input.imageFileId) badUserInput("Choose an image before publishing.");
        const file = await claimStoredFile(input.imageFileId, user._id.toString(), "post");
        payload.imageUrl = file.publicUrl || `/files/${file._id.toString()}`;
        payload.imagePath = file.path;
        payload.imageFileId = file._id;
        if (!payload.body) payload.body = "";
      }
      if (input.type === "poll") {
        const question = input.pollQuestion?.trim() ?? "";
        const options = (input.pollOptions ?? []).map((item) => item.trim()).filter(Boolean);
        if (!question) badUserInput("Polls need a question.");
        if (options.length < 2 || options.length > 4) {
          badUserInput("Polls need 2 to 4 options.");
        }
        payload.pollQuestion = question;
        payload.pollOptions = options.map((text) => ({ text, voteCount: 0 }));
        if (input.pollClosesAt) {
          const raw = input.pollClosesAt;
          const closes = raw.length <= 10 ? new Date(`${raw}T23:59:59.000Z`) : new Date(raw);
          if (Number.isNaN(closes.getTime())) badUserInput("Poll close date is invalid.");
          if (closes.getTime() <= Date.now()) badUserInput("Poll close date must be in the future.");
          payload.pollClosesAt = closes;
        }
      }
      try {
        return await Post.create(payload);
      } catch (error) {
        internalError("Failed to create post.", error);
      }
    },

    updatePost: async (
      _: unknown,
      { id, body }: { id: string; body: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Post ID", mongoose);
      const post = await Post.findById(id);
      if (!post) notFound("Post not found.");
      if (post.authorId.toString() !== user._id.toString() && normalizeRole(user.role) !== "admin") {
        forbidden("You can only edit your own posts.");
      }
      const next = body?.trim();
      if (!next) badUserInput("Post body cannot be empty.");
      post.body = next;
      return post.save();
    },

    deletePost: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Post ID", mongoose);
      const post = await Post.findById(id);
      if (!post) notFound("Post not found.");
      const isAuthor = post.authorId.toString() === user._id.toString();
      const isAdmin = normalizeRole(user.role) === "admin";
      let isMod = false;
      if (post.communityId) {
        const member = await CommunityMember.findOne({
          communityId: post.communityId,
          userId: user._id,
        });
        isMod = member?.role === "owner" || member?.role === "moderator";
      }
      if (!isAuthor && !isAdmin && !isMod) forbidden("You cannot delete this post.");
      await Promise.all([
        Comment.deleteMany({ postId: post._id }),
        PostLike.deleteMany({ postId: post._id }),
        SavedPost.deleteMany({ postId: post._id }),
        PollVote.deleteMany({ postId: post._id }),
        post.deleteOne(),
      ]);
      return true;
    },

    toggleLike: async (_: unknown, { postId }: { postId: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(postId, "Post ID", mongoose);
      const post = await Post.findById(postId);
      if (!post) notFound("Post not found.");
      await requirePostAccess(post, user._id.toString(), normalizeRole(user.role) === "admin");
      const existing = await PostLike.findOne({ postId, userId: user._id });
      try {
        if (existing) {
          await existing.deleteOne();
          post.likeCount = Math.max(0, post.likeCount - 1);
        } else {
          await PostLike.create({ postId, userId: user._id });
          post.likeCount += 1;
        }
        return post.save();
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return Post.findById(postId);
        internalError("Failed to update like.", error);
      }
    },

    addComment: async (
      _: unknown,
      { postId, body, parentId }: { postId: string; body: string; parentId?: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(postId, "Post ID", mongoose);
      const text = body?.trim();
      if (!text) badUserInput("Comment cannot be empty.");
      const post = await Post.findById(postId);
      if (!post) notFound("Post not found.");
      await requirePostAccess(post, user._id.toString(), normalizeRole(user.role) === "admin");
      if (parentId) {
        assertValidObjectId(parentId, "Parent comment ID", mongoose);
        const parent = await Comment.findById(parentId);
        if (!parent || parent.postId.toString() !== postId) {
          badUserInput("Parent comment is invalid.");
        }
      }
      try {
        const comment = await Comment.create({
          postId,
          authorId: user._id,
          parentId: parentId || undefined,
          body: text,
        });
        post.commentCount += 1;
        await post.save();
        return comment;
      } catch (error) {
        internalError("Failed to add comment.", error);
      }
    },

    deleteComment: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Comment ID", mongoose);
      const comment = await Comment.findById(id);
      if (!comment) notFound("Comment not found.");
      const post = await Post.findById(comment.postId);
      const isAuthor = comment.authorId.toString() === user._id.toString();
      const isAdmin = normalizeRole(user.role) === "admin";
      if (!isAuthor && !isAdmin) forbidden("You can only delete your own comments.");
      await comment.deleteOne();
      if (post) {
        post.commentCount = Math.max(0, post.commentCount - 1);
        await post.save();
      }
      return true;
    },

    toggleSavePost: async (_: unknown, { postId }: { postId: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(postId, "Post ID", mongoose);
      const post = await Post.findById(postId);
      if (!post) notFound("Post not found.");
      const existing = await SavedPost.findOne({ postId, userId: user._id });
      if (existing) {
        await existing.deleteOne();
        return false;
      }
      await SavedPost.create({ postId, userId: user._id });
      return true;
    },

    reportContent: async (
      _: unknown,
      { targetType, targetId, reason }: { targetType: string; targetId: string; reason: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      if (targetType !== "post" && targetType !== "comment") {
        badUserInput("You can only report a post or comment.");
      }
      assertValidObjectId(targetId, "Target ID", mongoose);
      const text = reason?.trim();
      if (!text || text.length < 8) badUserInput("Explain why you are reporting this (8+ characters).");
      if (targetType === "post") {
        const post = await Post.findById(targetId);
        if (!post) notFound("Post not found.");
      } else {
        const comment = await Comment.findById(targetId);
        if (!comment) notFound("Comment not found.");
      }
      try {
        await Report.create({
          reporterId: user._id,
          targetType,
          targetId,
          reason: text,
        });
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("You already reported this.");
        }
        internalError("Failed to submit report.", error);
      }
    },

    votePoll: async (
      _: unknown,
      { postId, optionIndex }: { postId: string; optionIndex: number },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(postId, "Post ID", mongoose);
      const post = await Post.findById(postId);
      if (!post) notFound("Post not found.");
      if (post.type !== "poll") badUserInput("This post is not a poll.");
      if (pollClosed(post)) badUserInput("This poll is closed.");
      if (optionIndex < 0 || optionIndex >= post.pollOptions.length) {
        badUserInput("Choose a valid poll option.");
      }
      await requirePostAccess(post, user._id.toString(), normalizeRole(user.role) === "admin");
      const existing = await PollVote.findOne({ postId, userId: user._id });
      if (existing) badUserInput("You already voted in this poll.");
      try {
        await PollVote.create({ postId, userId: user._id, optionIndex });
        post.pollOptions[optionIndex].voteCount += 1;
        post.markModified("pollOptions");
        return post.save();
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("You already voted in this poll.");
        }
        internalError("Failed to record vote.", error);
      }
    },
  },

  Post: {
    id: (parent: IPost) => parent._id.toString(),
    author: async (parent: IPost) => User.findById(parent.authorId),
    community: async (parent: IPost) =>
      parent.communityId ? Community.findById(parent.communityId) : null,
    likedByMe: async (parent: IPost, _: unknown, context: MyContext) => {
      if (!context.user) return false;
      return Boolean(await PostLike.findOne({ postId: parent._id, userId: context.user._id }));
    },
    savedByMe: async (parent: IPost, _: unknown, context: MyContext) => {
      if (!context.user) return false;
      return Boolean(await SavedPost.findOne({ postId: parent._id, userId: context.user._id }));
    },
    myPollVote: async (parent: IPost, _: unknown, context: MyContext) => {
      if (!context.user || parent.type !== "poll") return null;
      const vote = await PollVote.findOne({ postId: parent._id, userId: context.user._id });
      return vote?.optionIndex ?? null;
    },
    pollClosed: (parent: IPost) => pollClosed(parent),
    pollTotalVotes: (parent: IPost) =>
      parent.pollOptions.reduce((sum, option) => sum + option.voteCount, 0),
    createdAt: (parent: IPost) => parent.createdAt.toISOString(),
    updatedAt: (parent: IPost) => parent.updatedAt.toISOString(),
    pollClosesAt: (parent: IPost) => parent.pollClosesAt?.toISOString() ?? null,
    imageUrl: (parent: IPost) => parent.imageUrl || null,
  },

  Comment: {
    id: (parent: IComment) => parent._id.toString(),
    author: async (parent: IComment) => User.findById(parent.authorId),
    createdAt: (parent: IComment) => parent.createdAt.toISOString(),
  },
};
