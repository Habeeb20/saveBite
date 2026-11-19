import mongoose from 'mongoose';
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
      clientId: { type: String, maxlength: 64 },
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
