import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Exam, IExam } from "../models/Exam.js";
import { User, IUser } from "../models/User.js";

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

interface CreateUserInput {
  name: string;
  email: string;
  role?: "admin" | "student" | "instructor";
}

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

    exams: async (_: unknown, { isPublished }: { isPublished?: boolean }) => {
      try {
        const filter = typeof isPublished === "boolean" ? { isPublished } : {};
        return await Exam.find(filter).sort({ createdAt: -1 });
      } catch (error) {
        console.error("Error fetching exams:", error);
        throw new GraphQLError("Failed to fetch exams list from database.", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            originalError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    exam: async (_: unknown, { id }: { id: string }) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new GraphQLError(`Invalid Exam ID format: '${id}'`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      try {
        const exam = await Exam.findById(id);
        if (!exam) {
          throw new GraphQLError(`Exam not found with ID '${id}'`, {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return exam;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error(`Error fetching exam ${id}:`, error);
        throw new GraphQLError(`Failed to fetch exam with ID '${id}'`, {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    users: async () => {
      try {
        return await User.find().sort({ createdAt: -1 });
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new GraphQLError("Failed to fetch users list from database.", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            originalError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    user: async (_: unknown, { id }: { id: string }) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new GraphQLError(`Invalid User ID format: '${id}'`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      try {
        const user = await User.findById(id);
        if (!user) {
          throw new GraphQLError(`User not found with ID '${id}'`, {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return user;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error(`Error fetching user ${id}:`, error);
        throw new GraphQLError(`Failed to fetch user with ID '${id}'`, {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  Mutation: {
    createExam: async (_: unknown, { input }: { input: CreateExamInput }) => {
      if (!input.title || input.title.trim().length === 0) {
        throw new GraphQLError("Exam title is required and cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (input.durationMinutes <= 0) {
        throw new GraphQLError("Exam duration must be greater than 0 minutes.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (input.passingMarks > input.totalMarks) {
        throw new GraphQLError("Passing marks cannot exceed total marks.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        const exam = new Exam(input);
        return await exam.save();
      } catch (error) {
        console.error("Error creating exam:", error);
        throw new GraphQLError("Failed to create exam record.", {
          extensions: {
            code: "BAD_USER_INPUT",
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    updateExam: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateExamInput }
    ) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new GraphQLError(`Invalid Exam ID format: '${id}'`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        const updated = await Exam.findByIdAndUpdate(
          id,
          { $set: input },
          { new: true, runValidators: true }
        );
        if (!updated) {
          throw new GraphQLError(`Exam with ID '${id}' not found.`, {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return updated;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error(`Error updating exam ${id}:`, error);
        throw new GraphQLError("Failed to update exam.", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    deleteExam: async (_: unknown, { id }: { id: string }) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new GraphQLError(`Invalid Exam ID format: '${id}'`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        const result = await Exam.findByIdAndDelete(id);
        if (!result) {
          throw new GraphQLError(`Exam with ID '${id}' not found to delete.`, {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error(`Error deleting exam ${id}:`, error);
        throw new GraphQLError("Failed to delete exam record.", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    createUser: async (_: unknown, { input }: { input: CreateUserInput }) => {
      if (!input.name || input.name.trim().length === 0) {
        throw new GraphQLError("User name is required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
        throw new GraphQLError("A valid email address is required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        const existing = await User.findOne({ email: input.email.toLowerCase() });
        if (existing) {
          throw new GraphQLError(`User with email '${input.email}' already exists.`, {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        const user = new User({
          ...input,
          email: input.email.toLowerCase(),
        });
        return await user.save();
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Error creating user:", error);
        throw new GraphQLError("Failed to create user record.", {
          extensions: {
            code: "BAD_USER_INPUT",
            details: error instanceof Error ? error.message : String(error),
          },
        });
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

  User: {
    id: (parent: IUser) => parent._id.toString(),
    createdAt: (parent: IUser) =>
      parent.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: (parent: IUser) =>
      parent.updatedAt?.toISOString?.() || new Date().toISOString(),
  },
};
