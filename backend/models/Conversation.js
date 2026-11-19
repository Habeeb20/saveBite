import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    pair: { type: String, required: true, unique: true }, // "<smallerId>_<largerId>"
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: {
      text: String,
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: Date,
    },
    unread: { type: Map, of: Number, default: {} }, // userId -> unread count
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1, updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
