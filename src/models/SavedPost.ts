import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISavedPost extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const SavedPostSchema = new Schema<ISavedPost>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SavedPostSchema.index({ postId: 1, userId: 1 }, { unique: true });
SavedPostSchema.index({ userId: 1, createdAt: -1 });

export const SavedPost = mongoose.model<ISavedPost>("SavedPost", SavedPostSchema);
