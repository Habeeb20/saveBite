import mongoose from 'mongoose';
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['post', 'like', 'comment', 'repost', 'follow', 'message'], required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    text: String, // e.g. "liked your post" (the actor's name is rendered separately)
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

export default mongoose.model('Notification', notificationSchema);
