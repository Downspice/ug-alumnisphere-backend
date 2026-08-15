import mongoose, { Document, Schema, Types } from "mongoose";

export const POST_TYPES = ["text", "link", "poll", "image"] as const;
export type PostType = (typeof POST_TYPES)[number];

export interface IPollOption {
  text: string;
  voteCount: number;
}

export interface IPost extends Document {
  authorId: Types.ObjectId;
  communityId?: Types.ObjectId;
  type: PostType;
  body: string;
  imageUrl?: string;
  imagePath?: string;
  imageFileId?: Types.ObjectId;
  linkUrl?: string;
  pollQuestion?: string;
  pollOptions: IPollOption[];
  pollClosesAt?: Date;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: "Community", index: true },
    type: { type: String, enum: POST_TYPES, default: "text" },
    body: { type: String, trim: true, maxlength: 4000, default: "" },
    imageUrl: { type: String, default: "" },
    imagePath: { type: String, default: "" },
    imageFileId: { type: Schema.Types.ObjectId, ref: "StoredFile" },
    linkUrl: { type: String, trim: true, maxlength: 500, default: "" },
    pollQuestion: { type: String, trim: true, maxlength: 240, default: "" },
    pollOptions: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 80 },
          voteCount: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    pollClosesAt: { type: Date },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ communityId: 1, createdAt: -1 });

export const Post = mongoose.model<IPost>("Post", PostSchema);
