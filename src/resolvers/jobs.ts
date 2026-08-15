import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Job, IJob, JOB_TYPES } from "../models/Job.js";
import {
  JobApplication,
  IJobApplication,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from "../models/JobApplication.js";
import { SavedJob } from "../models/SavedJob.js";
import type { MyContext } from "../types/context.js";
import { normalizeRole, requireAuth, requireRole } from "../utils/auth.js";
import { assertValidObjectId, badUserInput, forbidden, internalError, notFound } from "../utils/errors.js";
import { claimStoredFile } from "../utils/storage.js";
import { notify } from "../utils/notify.js";

const POSTER_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  submitted: ["reviewing", "shortlisted", "rejected"],
  reviewing: ["shortlisted", "rejected"],
  shortlisted: ["rejected", "reviewing"],
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const jobResolvers = {
  Query: {
    jobs: async (
      _: unknown,
      {
        search,
        type,
        location,
        industry,
        sort,
      }: { search?: string; type?: string; location?: string; industry?: string; sort?: string },
      context: MyContext
    ) => {
      requireAuth(context);
      const filter: Record<string, unknown> = { status: "open" };
      if (type && type !== "any") {
        if (!JOB_TYPES.includes(type as (typeof JOB_TYPES)[number])) {
          badUserInput("Invalid job type.");
        }
        filter.type = type;
      }
      if (location?.trim()) filter.location = new RegExp(escapeRegex(location.trim()), "i");
      if (industry?.trim()) filter.industry = new RegExp(escapeRegex(industry.trim()), "i");
      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [{ title: term }, { company: term }, { description: term }];
      }
      try {
        const query = Job.find(filter);
        return sort === "TITLE_ASC"
          ? await query.sort({ title: 1 }).limit(80)
          : await query.sort({ createdAt: -1 }).limit(80);
      } catch (error) {
        internalError("Failed to load jobs.", error);
      }
    },

    job: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAuth(context);
      assertValidObjectId(id, "Job ID", mongoose);
      const job = await Job.findById(id);
      if (!job) notFound("Job not found.");
      return job;
    },

    myJobApplications: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await JobApplication.find({ applicantId: user._id }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load applications.", error);
      }
    },

    jobApplications: async (_: unknown, { jobId }: { jobId: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(jobId, "Job ID", mongoose);
      const job = await Job.findById(jobId);
      if (!job) notFound("Job not found.");
      if (job.postedById.toString() !== user._id.toString() && normalizeRole(user.role) !== "admin") {
        forbidden("Only the poster can review applications.");
      }
      return JobApplication.find({ jobId }).sort({ createdAt: -1 });
    },

    savedJobs: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      const saved = await SavedJob.find({ userId: user._id }).sort({ createdAt: -1 });
      const jobs = await Job.find({ _id: { $in: saved.map((item) => item.jobId) } });
      const byId = new Map(jobs.map((job) => [job._id.toString(), job]));
      return saved.map((item) => byId.get(item.jobId.toString())).filter(Boolean);
    },

    myPostedJobs: async (_: unknown, __: unknown, context: MyContext) => {
      const { user } = requireAuth(context);
      try {
        return await Job.find({ postedById: user._id }).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to load posted jobs.", error);
      }
    },
  },

  Mutation: {
    createJob: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          title: string;
          company: string;
          location: string;
          type: string;
          industry?: string;
          description: string;
          requirements?: string;
          applicationUrl?: string;
        };
      },
      context: MyContext
    ) => {
      const { user } = requireRole(context, ["alumni", "admin"]);
      if (!JOB_TYPES.includes(input.type as (typeof JOB_TYPES)[number])) {
        badUserInput("Job type must be full_time, part_time, internship, or contract.");
      }
      if (!input.title?.trim() || !input.company?.trim() || !input.location?.trim()) {
        badUserInput("Title, company, and location are required.");
      }
      if (!input.description?.trim() || input.description.trim().length < 20) {
        badUserInput("Describe the role in at least 20 characters.");
      }
      if (input.applicationUrl?.trim()) {
        try {
          const url = new URL(input.applicationUrl.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            badUserInput("Application URL must be http(s).");
          }
        } catch {
          badUserInput("Application URL is invalid.");
        }
      }
      try {
        return await Job.create({
          title: input.title.trim(),
          company: input.company.trim(),
          location: input.location.trim(),
          type: input.type,
          industry: input.industry?.trim() ?? "",
          description: input.description.trim(),
          requirements: input.requirements?.trim() ?? "",
          applicationUrl: input.applicationUrl?.trim() ?? "",
          postedById: user._id,
          status: "open",
        });
      } catch (error) {
        internalError("Failed to create job.", error);
      }
    },

    closeJob: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Job ID", mongoose);
      const job = await Job.findById(id);
      if (!job) notFound("Job not found.");
      if (job.postedById.toString() !== user._id.toString() && normalizeRole(user.role) !== "admin") {
        forbidden("Only the poster can close this job.");
      }
      job.status = "closed";
      return job.save();
    },

    applyToJob: async (
      _: unknown,
      { jobId, coverNote, resumeFileId }: { jobId: string; coverNote: string; resumeFileId?: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(jobId, "Job ID", mongoose);
      const note = coverNote?.trim();
      if (!note || note.length < 20) badUserInput("Write a cover note of at least 20 characters.");
      const job = await Job.findById(jobId);
      if (!job) notFound("Job not found.");
      if (job.status !== "open") badUserInput("This job is no longer accepting applications.");
      if (job.postedById.toString() === user._id.toString()) {
        badUserInput("You cannot apply to your own listing.");
      }
      const resume = resumeFileId
        ? await claimStoredFile(resumeFileId, user._id.toString(), "resume")
        : null;
      try {
        const application = await JobApplication.create({
          jobId: job._id,
          applicantId: user._id,
          coverNote: note,
          resumeFileName: resume?.originalName ?? "",
          resumePath: resume?.path ?? "",
          resumeFileId: resume?._id,
          status: "submitted",
        });
        await notify({
          userId: job.postedById.toString(),
          title: "New job application",
          body: `${user.name} applied for ${job.title}.`,
          href: `/jobs/${job._id.toString()}`,
        });
        return application;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          badUserInput("You already applied to this job.");
        }
        internalError("Failed to submit application.", error);
      }
    },

    withdrawApplication: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Application ID", mongoose);
      const application = await JobApplication.findById(id);
      if (!application) notFound("Application not found.");
      if (application.applicantId.toString() !== user._id.toString()) {
        forbidden("You can only withdraw your own application.");
      }
      if (application.status === "withdrawn") badUserInput("This application is already withdrawn.");
      if (application.status === "rejected") badUserInput("A rejected application cannot be withdrawn.");
      application.status = "withdrawn";
      return application.save();
    },

    updateApplicationStatus: async (
      _: unknown,
      { id, status }: { id: string; status: string },
      context: MyContext
    ) => {
      const { user } = requireAuth(context);
      assertValidObjectId(id, "Application ID", mongoose);
      if (!APPLICATION_STATUSES.includes(status as ApplicationStatus) || status === "withdrawn") {
        badUserInput("Invalid application status.");
      }
      const application = await JobApplication.findById(id);
      if (!application) notFound("Application not found.");
      const job = await Job.findById(application.jobId);
      if (!job) notFound("Job not found.");
      if (job.postedById.toString() !== user._id.toString() && normalizeRole(user.role) !== "admin") {
        forbidden("Only the poster can update application status.");
      }
      const allowed = POSTER_TRANSITIONS[application.status] ?? [];
      if (!allowed.includes(status as ApplicationStatus)) {
        badUserInput(`Cannot move an application from ${application.status} to ${status}.`);
      }
      application.status = status as ApplicationStatus;
      await application.save();
      await notify({
        userId: application.applicantId.toString(),
        title: "Application updated",
        body: `Your application for ${job.title} is now ${status}.`,
        href: `/jobs/${job._id.toString()}`,
      });
      return application;
    },

    toggleSaveJob: async (_: unknown, { jobId }: { jobId: string }, context: MyContext) => {
      const { user } = requireAuth(context);
      assertValidObjectId(jobId, "Job ID", mongoose);
      const job = await Job.findById(jobId);
      if (!job) notFound("Job not found.");
      const existing = await SavedJob.findOne({ jobId, userId: user._id });
      if (existing) {
        await existing.deleteOne();
        return false;
      }
      await SavedJob.create({ jobId, userId: user._id });
      return true;
    },
  },

  Job: {
    id: (parent: IJob) => parent._id.toString(),
    postedBy: async (parent: IJob) => User.findById(parent.postedById),
    savedByMe: async (parent: IJob, _: unknown, context: MyContext) => {
      if (!context.user) return false;
      return Boolean(await SavedJob.findOne({ jobId: parent._id, userId: context.user._id }));
    },
    myApplication: async (parent: IJob, _: unknown, context: MyContext) => {
      if (!context.user) return null;
      return JobApplication.findOne({ jobId: parent._id, applicantId: context.user._id });
    },
    applicationCount: async (parent: IJob) => JobApplication.countDocuments({ jobId: parent._id }),
    createdAt: (parent: IJob) => parent.createdAt.toISOString(),
    updatedAt: (parent: IJob) => parent.updatedAt.toISOString(),
  },

  JobApplication: {
    id: (parent: IJobApplication) => parent._id.toString(),
    job: async (parent: IJobApplication) => {
      const job = await Job.findById(parent.jobId);
      if (!job) notFound("Job no longer exists.");
      return job;
    },
    applicant: async (parent: IJobApplication) => User.findById(parent.applicantId),
    resumeDownloadUrl: (parent: IJobApplication) =>
      parent.resumeFileId ? `/files/${parent.resumeFileId.toString()}` : null,
    createdAt: (parent: IJobApplication) => parent.createdAt.toISOString(),
    updatedAt: (parent: IJobApplication) => parent.updatedAt.toISOString(),
  },
};
