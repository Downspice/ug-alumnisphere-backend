import mongoose from "mongoose";
import { authResolvers } from "./auth.js";
import { userResolvers } from "./users.js";
import { examResolvers } from "./exams.js";
import { verificationResolvers } from "./verification.js";
import { directoryResolvers } from "./directory.js";
import { connectionResolvers } from "./connections.js";
import { messagingResolvers } from "./messaging.js";
import { communityResolvers } from "./communities.js";
import { postResolvers } from "./posts.js";
import { jobResolvers } from "./jobs.js";
import { mentorshipResolvers } from "./mentorship.js";
import { eventResolvers } from "./events.js";
import { notificationResolvers } from "./notifications.js";

export const resolvers = {
  Query: {
    health: async () => {
      const dbState = mongoose.connection.readyState;
      const dbStateMap: Record<number, string> = {
        0: "Disconnected",
        1: "Connected",
        2: "Connecting",
        3: "Disconnecting",
      };

      return {
        status: "OK",
        timestamp: new Date().toISOString(),
        database: dbStateMap[dbState] || "Unknown",
        uptime: process.uptime(),
      };
    },
    ...authResolvers.Query,
    ...userResolvers.Query,
    ...examResolvers.Query,
    ...verificationResolvers.Query,
    ...directoryResolvers.Query,
    ...connectionResolvers.Query,
    ...messagingResolvers.Query,
    ...communityResolvers.Query,
    ...postResolvers.Query,
    ...jobResolvers.Query,
    ...mentorshipResolvers.Query,
    ...eventResolvers.Query,
    ...notificationResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...examResolvers.Mutation,
    ...verificationResolvers.Mutation,
    ...connectionResolvers.Mutation,
    ...messagingResolvers.Mutation,
    ...communityResolvers.Mutation,
    ...postResolvers.Mutation,
    ...jobResolvers.Mutation,
    ...mentorshipResolvers.Mutation,
    ...eventResolvers.Mutation,
    ...notificationResolvers.Mutation,
  },
  User: {
    ...userResolvers.User,
    ...directoryResolvers.User,
  },
  AuthPayload: authResolvers.AuthPayload,
  Exam: examResolvers.Exam,
  VerificationRequest: verificationResolvers.VerificationRequest,
  Connection: connectionResolvers.Connection,
  Conversation: messagingResolvers.Conversation,
  Message: messagingResolvers.Message,
  Community: communityResolvers.Community,
  CommunityMember: communityResolvers.CommunityMember,
  CommunityJoinRequest: communityResolvers.CommunityJoinRequest,
  Post: postResolvers.Post,
  Comment: postResolvers.Comment,
  Job: jobResolvers.Job,
  JobApplication: jobResolvers.JobApplication,
  MentorshipRequest: mentorshipResolvers.MentorshipRequest,
  Mentorship: mentorshipResolvers.Mentorship,
  MentorshipGoal: mentorshipResolvers.MentorshipGoal,
  Event: eventResolvers.Event,
  EventRegistration: eventResolvers.EventRegistration,
  Notification: notificationResolvers.Notification,
};
