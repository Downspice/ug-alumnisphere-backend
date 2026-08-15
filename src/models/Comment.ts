import mongoose, { Document, Schema, Types } from "mongoose";

export interface IComment extends Document {
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  parentId?: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>("Comment", CommentSchema);
