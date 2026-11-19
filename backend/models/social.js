import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const likeSchema = new Schema({ post: ref("Post", { required: true }), user: ref("User", { required: true }) }, { timestamps: { createdAt: true, updatedAt: false } });
likeSchema.index({ post: 1, user: 1 }, { unique: true });
likeSchema.index({ user: 1, post: 1 });

const commentSchema = new Schema(
  { post: ref("Post", { required: true }), author: ref("User", { required: true }), text: { type: String, required: true, trim: true, maxlength: 500 } },
  { timestamps: true }
);
commentSchema.index({ post: 1, createdAt: -1 });

const followSchema = new Schema({ follower: ref("User", { required: true }), following: ref("User", { required: true }) }, { timestamps: { createdAt: true, updatedAt: false } });
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 });

const notificationSchema = new Schema(
  {
    user: ref("User", { required: true }),
    actor: ref("User"),
    type: { type: String, enum: ["like", "comment", "repost", "follow", "new_post"], required: true },
    post: ref("Post"),
    text: { type: String, maxlength: 300 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // auto-clean after 90 days

export const PostLike = mongoose.models.PostLike || mongoose.model("PostLike", likeSchema);
export const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);
export const Follow = mongoose.models.Follow || mongoose.model("Follow", followSchema);
export const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);