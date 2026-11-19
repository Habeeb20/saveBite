import mongoose from "mongoose";

const { Schema } = mongoose;

// Holds an email that is still being verified, so no half-finished User is ever created.
const pendingSignupSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    // MongoDB deletes the document automatically at this time (TTL index).
    expireAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export default mongoose.models.PendingSignup ||
  mongoose.model("PendingSignup", pendingSignupSchema);
