import mongoose from "mongoose";
import { User } from "../models/User.js";
import {
  MentorshipRequest,
  IMentorshipRequest,
  mentorshipPairKey,
} from "../models/MentorshipRequest.js";
import { Mentorship, IMentorship } from "../models/Mentorship.js";
import type { MyContext } from "../types/context.js";
import { requireAuth } from "../utils/auth.js";
import {
  assertValidObjectId,
  badUserInput,
  forbidden,
  internalError,
  notFound,
} from "../utils/errors.js";
import { notify } from "../utils/notify.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireParticipant(mentorship: IMentorship, userId: string) {
  const ids = [mentorship.mentorId.toString(), mentorship.menteeId.toString()];
  if (!ids.includes(userId)) forbidden("You are not part of this mentorship.");
}

export const mentorshipResolvers = {
  Query: {
    mentors: async (
      _: unknown,
      {
        search,
        industry,
        location,
      }: { search?: string; industry?: string; location?: string },
      context: MyContext
    ) => {
      requireAuth(context);
      const filter: Record<string, unknown> = {
        openToMentor: true,
        accountStatus: "active",
        role: { $in: ["alumni", "admin"] },
      };
      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [{ name: term }, { headline: term }, { programme: term }];
      }
      if (industry?.trim())
        filter.industry = new RegExp(escapeRegex(industry.trim()), "i");
      if (location?.trim())
        filter.location = new RegExp(escapeRegex(location.trim()), "i");
      try {
        return await User.find(filter).sort({ updatedAt: -1 }).limit(40);
      } catch (error) {
        internalError("Failed to load mentors.", error);
      }
    },

    mentorshipRequestStatus: async (
      _: unknown,
      { userId }: { userId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(userId, "User ID", mongoose);
      const pairKey = mentorshipPairKey(user._id.toString(), userId);
      return MentorshipRequest.findOne({ pairKey }).sort({ createdAt: -1 });
    },

    incomingMentorshipRequests: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      return MentorshipRequest.find({ mentorId: user._id, status: "pending" }).sort({
        createdAt: -1,
      });
    },

    sentMentorshipRequests: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      return MentorshipRequest.find({ menteeId: user._id }).sort({ createdAt: -1 });
    },

    myMentorships: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Mentorship.find({
          $or: [{ mentorId: user._id }, { menteeId: user._id }],
        }).sort({ updatedAt: -1 });
      } catch (error) {
        internalError("Failed to load mentorships.", error);
      }
    },
  },

  Mutation: {
    requestMentorship: async (
      _: unknown,
      { mentorId, message }: { mentorId: string; message: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(mentorId, "Mentor ID", mongoose);
      if (mentorId === user._id.toString()) badUserInput("You cannot mentor yourself.");
      const note = message?.trim();
      if (!note || note.length < 20)
        badUserInput("Explain what you need in at least 20 characters.");
      const mentor = await User.findById(mentorId);
      if (!mentor) notFound("Mentor not found.");
      if (!mentor.openToMentor) badUserInput("This person is not open to mentorship.");
      const pairKey = mentorshipPairKey(user._id.toString(), mentorId);
      const active = await Mentorship.findOne({ pairKey, status: "active" });
      if (active) badUserInput("You already have an active mentorship with this person.");
      const pending = await MentorshipRequest.findOne({ pairKey, status: "pending" });
      if (pending) badUserInput("A mentorship request is already pending.");
      try {
        const request = await MentorshipRequest.create({
          menteeId: user._id,
          mentorId,
          pairKey,
          message: note,
          status: "pending",
        });
        await notify({
          userId: mentorId,
          title: "Mentorship request",
          body: `${user.name} asked you to mentor them.`,
          href: "/mentorship",
        });
        return request;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("A mentorship request is already pending.");
        }
        internalError("Failed to send mentorship request.", error);
      }
    },

    acceptMentorshipRequest: async (
      _: unknown,
      { id }: { id: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Request ID", mongoose);
      const request = await MentorshipRequest.findById(id);
      if (!request) notFound("Mentorship request not found.");
      if (request.mentorId.toString() !== user._id.toString()) {
        forbidden("Only the requested mentor can accept this.");
      }
      if (request.status !== "pending")
        badUserInput("This request is no longer pending.");
      request.status = "accepted";
      await request.save();
      const existing = await Mentorship.findOne({ pairKey: request.pairKey });
      if (existing) {
        existing.status = "active";
        existing.mentorId = request.mentorId;
        existing.menteeId = request.menteeId;
        return existing.save();
      }
      try {
        return await Mentorship.create({
          mentorId: request.mentorId,
          menteeId: request.menteeId,
          pairKey: request.pairKey,
          status: "active",
          goals: [],
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          const again = await Mentorship.findOne({ pairKey: request.pairKey });
          if (!again) notFound("Mentorship not found after accept.");
          return again;
        }
        internalError("Failed to start mentorship.", error);
      }
    },

    declineMentorshipRequest: async (
      _: unknown,
      { id }: { id: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Request ID", mongoose);
      const request = await MentorshipRequest.findById(id);
      if (!request) notFound("Mentorship request not found.");
      if (request.mentorId.toString() !== user._id.toString()) {
        forbidden("Only the requested mentor can decline this.");
      }
      if (request.status !== "pending")
        badUserInput("This request is no longer pending.");
      request.status = "declined";
      return request.save();
    },

    addMentorshipGoal: async (
      _: unknown,
      { mentorshipId, text }: { mentorshipId: string; text: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(mentorshipId, "Mentorship ID", mongoose);
      const goal = text?.trim();
      if (!goal) badUserInput("Goal text is required.");
      const mentorship = await Mentorship.findById(mentorshipId);
      if (!mentorship) notFound("Mentorship not found.");
      await requireParticipant(mentorship, user._id.toString());
      if (mentorship.status !== "active") badUserInput("This mentorship is closed.");
      mentorship.goals.push({ text: goal, done: false } as IMentorship["goals"][number]);
      return mentorship.save();
    },

    toggleMentorshipGoal: async (
      _: unknown,
      { mentorshipId, goalId }: { mentorshipId: string; goalId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(mentorshipId, "Mentorship ID", mongoose);
      assertValidObjectId(goalId, "Goal ID", mongoose);
      const mentorship = await Mentorship.findById(mentorshipId);
      if (!mentorship) notFound("Mentorship not found.");
      await requireParticipant(mentorship, user._id.toString());
      const goal = mentorship.goals.find((item) => item._id.toString() === goalId);
      if (!goal) notFound("Goal not found.");
      goal.done = !goal.done;
      return mentorship.save();
    },

    closeMentorship: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Mentorship ID", mongoose);
      const mentorship = await Mentorship.findById(id);
      if (!mentorship) notFound("Mentorship not found.");
      await requireParticipant(mentorship, user._id.toString());
      mentorship.status = "closed";
      return mentorship.save();
    },
  },

  MentorshipRequest: {
    id: (parent: IMentorshipRequest) => parent._id.toString(),
    mentee: async (parent: IMentorshipRequest) => User.findById(parent.menteeId),
    mentor: async (parent: IMentorshipRequest) => User.findById(parent.mentorId),
    createdAt: (parent: IMentorshipRequest) => parent.createdAt.toISOString(),
  },

  Mentorship: {
    id: (parent: IMentorship) => parent._id.toString(),
    mentor: async (parent: IMentorship) => User.findById(parent.mentorId),
    mentee: async (parent: IMentorship) => User.findById(parent.menteeId),
    createdAt: (parent: IMentorship) => parent.createdAt.toISOString(),
    updatedAt: (parent: IMentorship) => parent.updatedAt.toISOString(),
  },

  MentorshipGoal: {
    id: (parent: { _id: mongoose.Types.ObjectId }) => parent._id.toString(),
  },
};
