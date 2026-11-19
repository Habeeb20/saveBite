import mongoose from 'mongoose';
const { Schema } = mongoose;

// Remembers the answer to a request so a retry (after a dropped connection) is never applied twice.
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  state: { type: String, enum: ['pending', 'done'], default: 'pending' },
  status: Number,
  body: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // forget after 24h
});
schema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model('IdempotencyKey', schema);
