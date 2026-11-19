import mongoose from 'mongoose';
const { Schema } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['stock', 'menu', 'wanted'], required: true, index: true },
    text: {
      type: String, trim: true, maxlength: 1000,
      required: function () { return !this.repostOf; }, // a repost has no text of its own
    },
    images: { type: [{ _id: false, url: String, publicId: String }], default: [] },
    emoji: String,
    tint: String,
    price: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 20 },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    repostOf: { type: Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
// one repost per user per post
postSchema.index(
  { author: 1, repostOf: 1 },
  { unique: true, partialFilterExpression: { repostOf: { $type: 'objectId' } } }
);

export default mongoose.model('Post', postSchema);







