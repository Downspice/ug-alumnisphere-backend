import mongoose from "mongoose";
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
        const exams = await Exam.find(filter).sort({ createdAt: -1 });
        return exams;
      } catch (error) {
        console.error("Error fetching exams:", error);
        return [];
      }
    },

    exam: async (_: unknown, { id }: { id: string }) => {
      try {
        return await Exam.findById(id);
      } catch (error) {
        console.error(`Error fetching exam ${id}:`, error);
        return null;
      }
    },

    users: async () => {
      try {
        return await User.find().sort({ createdAt: -1 });
      } catch (error) {
        console.error("Error fetching users:", error);
        return [];
      }
    },

    user: async (_: unknown, { id }: { id: string }) => {
      try {
        return await User.findById(id);
      } catch (error) {
        console.error(`Error fetching user ${id}:`, error);
        return null;
      }
    },
  },

  Mutation: {
    createExam: async (_: unknown, { input }: { input: CreateExamInput }) => {
      const exam = new Exam(input);
      return await exam.save();
    },

    updateExam: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateExamInput }
    ) => {
      return await Exam.findByIdAndUpdate(id, { $set: input }, { new: true });
    },

    deleteExam: async (_: unknown, { id }: { id: string }) => {
      const result = await Exam.findByIdAndDelete(id);
      return !!result;
    },

    createUser: async (_: unknown, { input }: { input: CreateUserInput }) => {
      const user = new User(input);
      return await user.save();
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
