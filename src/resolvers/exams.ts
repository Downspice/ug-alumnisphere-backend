import mongoose from "mongoose";
import { Exam, IExam } from "../models/Exam.js";
import type { MyContext } from "../types/context.js";
import { requireAdmin, requireAuth } from "../utils/auth.js";
import { assertValidObjectId, badUserInput, internalError, notFound } from "../utils/errors.js";

interface CreateExamInput {
  title: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  questions?: Array<{
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    points?: number;
  }>;
  isPublished?: boolean;
}

interface UpdateExamInput {
  title?: string;
  description?: string;
  durationMinutes?: number;
  totalMarks?: number;
  passingMarks?: number;
  questions?: Array<{
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    points?: number;
  }>;
  isPublished?: boolean;
}

export const examResolvers = {
  Query: {
    exams: async (
      _: unknown,
      { isPublished }: { isPublished?: boolean },
      context: MyContext
    ) => {
      requireAuth(context);
      try {
        const filter = typeof isPublished === "boolean" ? { isPublished } : {};
        return await Exam.find(filter).sort({ createdAt: -1 });
      } catch (error) {
        internalError("Failed to fetch exams list from database.", error);
      }
    },

    exam: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAuth(context);
      assertValidObjectId(id, "Exam ID", mongoose);
      try {
        const exam = await Exam.findById(id);
        if (!exam) {
          notFound(`Exam not found with ID '${id}'`);
        }
        return exam;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError(`Failed to fetch exam with ID '${id}'`, error);
      }
    },
  },

  Mutation: {
    createExam: async (
      _: unknown,
      { input }: { input: CreateExamInput },
      context: MyContext
    ) => {
      requireAdmin(context);
      if (!input.title || input.title.trim().length === 0) {
        badUserInput("Exam title is required and cannot be empty.");
      }
      if (input.durationMinutes <= 0) {
        badUserInput("Exam duration must be greater than 0 minutes.");
      }
      if (input.passingMarks > input.totalMarks) {
        badUserInput("Passing marks cannot exceed total marks.");
      }

      try {
        const exam = new Exam(input);
        return await exam.save();
      } catch (error) {
        internalError("Failed to create exam record.", error);
      }
    },

    updateExam: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateExamInput },
      context: MyContext
    ) => {
      requireAdmin(context);
      assertValidObjectId(id, "Exam ID", mongoose);

      try {
        const updated = await Exam.findByIdAndUpdate(
          id,
          { $set: input },
          { new: true, runValidators: true }
        );
        if (!updated) {
          notFound(`Exam with ID '${id}' not found.`);
        }
        return updated;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to update exam.", error);
      }
    },

    deleteExam: async (_: unknown, { id }: { id: string }, context: MyContext) => {
      requireAdmin(context);
      assertValidObjectId(id, "Exam ID", mongoose);

      try {
        const result = await Exam.findByIdAndDelete(id);
        if (!result) {
          notFound(`Exam with ID '${id}' not found to delete.`);
        }
        return true;
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to delete exam record.", error);
      }
    },
  },

  Exam: {
    id: (parent: IExam) => parent._id.toString(),
    createdAt: (parent: IExam) =>
      parent.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: (parent: IExam) =>
      parent.updatedAt?.toISOString?.() || new Date().toISOString(),
  },
};
