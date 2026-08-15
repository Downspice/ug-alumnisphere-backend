import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Event, IEvent } from "../models/Event.js";
import { EventRegistration, IEventRegistration } from "../models/EventRegistration.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAdmin, requireAuth } from "../utils/auth.js";
import {
  assertValidObjectId,
  badUserInput,
  forbidden,
  internalError,
  notFound,
} from "../utils/errors.js";
import { claimStoredFile, coverFieldsFromFile } from "../utils/storage.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDate(value: string, label: string) {
  const date = value.length <= 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) badUserInput(`${label} is invalid.`);
  return date;
}

export const eventResolvers = {
  Query: {
    events: async (
      _: unknown,
      {
        search,
        location,
        includeUnpublished,
      }: { search?: string; location?: string; includeUnpublished?: boolean },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      const filter: Record<string, unknown> = {};
      if (includeUnpublished) {
        if (normalizeRole(user.role) !== "admin") {
          forbidden("Only administrators can list unpublished events.");
        }
      } else {
        filter.status = "published";
      }
      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [{ title: term }, { description: term }];
      }
      if (location?.trim())
        filter.location = new RegExp(escapeRegex(location.trim()), "i");
      try {
        return await Event.find(filter).sort({ startsAt: 1 }).limit(80);
      } catch (error) {
        internalError("Failed to load events.", error);
      }
    },

    event: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Event ID", mongoose);
      const event = await Event.findById(id);
      if (!event) notFound("Event not found.");
      if (event.status !== "published" && normalizeRole(user.role) !== "admin") {
        forbidden("This event is not published.");
      }
      return event;
    },

    myEventRegistrations: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await EventRegistration.find({ userId: user._id }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load registrations.", error);
      }
    },
  },

  Mutation: {
    createEvent: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          title: string;
          description: string;
          location: string;
          startsAt: string;
          endsAt?: string;
          capacity?: number;
          coverFileId?: string;
        };
      },
      context: MyContext
    ) => {
      const { user } = requireAdmin(context);
      if (!input.title?.trim() || !input.description?.trim() || !input.location?.trim()) {
        badUserInput("Title, description, and location are required.");
      }
      const startsAt = parseDate(input.startsAt, "Start date");
      const endsAt = input.endsAt ? parseDate(input.endsAt, "End date") : undefined;
      if (endsAt && endsAt.getTime() < startsAt.getTime()) {
        badUserInput("End date must be after the start date.");
      }
      if (input.capacity !== undefined && input.capacity !== null && input.capacity < 1) {
        badUserInput("Capacity must be at least 1.");
      }
      const cover = input.coverFileId
        ? await claimStoredFile(input.coverFileId, user._id.toString(), "event")
        : null;
      try {
        return await Event.create({
          title: input.title.trim(),
          description: input.description.trim(),
          location: input.location.trim(),
          startsAt,
          endsAt,
          capacity: input.capacity || undefined,
          status: "draft",
          createdById: user._id,
          ...coverFieldsFromFile(cover),
        });
      } catch (error) {
        internalError("Failed to create event.", error);
      }
    },

    updateEvent: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          title?: string;
          description?: string;
          location?: string;
          startsAt?: string;
          endsAt?: string;
          capacity?: number;
          coverFileId?: string;
        };
      },
      context: MyContext
    ) => {
      const { user } = requireAdmin(context);
      assertValidObjectId(id, "Event ID", mongoose);
      const event = await Event.findById(id);
      if (!event) notFound("Event not found.");
      if (event.status === "cancelled")
        badUserInput("Cancelled events cannot be edited.");
      if (input.title?.trim()) event.title = input.title.trim();
      if (input.description?.trim()) event.description = input.description.trim();
      if (input.location?.trim()) event.location = input.location.trim();
      if (input.startsAt) event.startsAt = parseDate(input.startsAt, "Start date");
      if (input.endsAt) event.endsAt = parseDate(input.endsAt, "End date");
      if (input.capacity !== undefined) event.capacity = input.capacity || undefined;
      if (input.coverFileId) {
        const cover = await claimStoredFile(
          input.coverFileId,
          user._id.toString(),
          "event"
        );
        Object.assign(event, coverFieldsFromFile(cover));
      }
      if (event.endsAt && event.endsAt.getTime() < event.startsAt.getTime()) {
        badUserInput("End date must be after the start date.");
      }
      return event.save();
    },

    publishEvent: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Event ID", mongoose);
      const event = await Event.findById(id);
      if (!event) notFound("Event not found.");
      if (event.status === "cancelled")
        badUserInput("A cancelled event cannot be published.");
      event.status = "published";
      return event.save();
    },

    cancelEvent: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Event ID", mongoose);
      const event = await Event.findById(id);
      if (!event) notFound("Event not found.");
      event.status = "cancelled";
      return event.save();
    },

    registerForEvent: async (
      _: unknown,
      { eventId }: { eventId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(eventId, "Event ID", mongoose);
      const event = await Event.findById(eventId);
      if (!event) notFound("Event not found.");
      if (event.status !== "published")
        badUserInput("This event is not open for registration.");
      if (event.capacity) {
        const count = await EventRegistration.countDocuments({ eventId });
        if (count >= event.capacity) badUserInput("This event is full.");
      }
      const existing = await EventRegistration.findOne({ eventId, userId: user._id });
      if (existing) {
        badUserInput("You are already registered for this event.");
      }
      try {
        return await EventRegistration.create({ eventId, userId: user._id });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("You are already registered for this event.");
        }
        internalError("Failed to register for the event.", error);
      }
    },

    cancelEventRegistration: async (
      _: unknown,
      { eventId }: { eventId: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(eventId, "Event ID", mongoose);
      const registration = await EventRegistration.findOne({ eventId, userId: user._id });
      if (!registration) badUserInput("You are not registered for this event.");
      await registration.deleteOne();
      return true;
    },
  },

  Event: {
    id: (parent: IEvent) => parent._id.toString(),
    createdBy: async (parent: IEvent) => User.findById(parent.createdById),
    registeredCount: async (parent: IEvent) =>
      EventRegistration.countDocuments({ eventId: parent._id }),
    registeredByMe: async (parent: IEvent, _: unknown, context: MyContext) => {
      if (!context.user) return false;
      return Boolean(
        await EventRegistration.findOne({ eventId: parent._id, userId: context.user._id })
      );
    },
    startsAt: (parent: IEvent) => parent.startsAt.toISOString(),
    endsAt: (parent: IEvent) => parent.endsAt?.toISOString() ?? null,
    createdAt: (parent: IEvent) => parent.createdAt.toISOString(),
    coverImageUrl: (parent: IEvent) => parent.coverImageUrl || null,
  },

  EventRegistration: {
    id: (parent: IEventRegistration) => parent._id.toString(),
    event: async (parent: IEventRegistration) => {
      const event = await Event.findById(parent.eventId);
      if (!event) notFound("Event no longer exists.");
      return event;
    },
    user: async (parent: IEventRegistration) => User.findById(parent.userId),
    createdAt: (parent: IEventRegistration) => parent.createdAt.toISOString(),
  },
};
