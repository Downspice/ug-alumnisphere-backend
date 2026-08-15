import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPostLike extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const PostLikeSchema = new Schema<IPostLike>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const PostLike = mongoose.model<IPostLike>("PostLike", PostLikeSchema);
