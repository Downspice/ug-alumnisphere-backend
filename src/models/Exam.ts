import mongoose, { Document, Schema } from "mongoose";

export interface IQuestion {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
}

export interface IExam extends Document {
  title: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  questions: IQuestion[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema: Schema = new Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true },
  points: { type: Number, default: 1 },
});

const ExamSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    durationMinutes: { type: Number, required: true, default: 60 },
    totalMarks: { type: Number, required: true, default: 100 },
    passingMarks: { type: Number, required: true, default: 40 },
    questions: [QuestionSchema],
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const Exam = mongoose.model<IExam>("Exam", ExamSchema);
