import mongoose from 'mongoose';
const { Schema } = mongoose;

const txSchema = new Schema(
  {
    type: { type: String, enum: ['deposit', 'auto_deposit', 'withdrawal', 'penalty', 'interest', 'auto_missed'], required: true },
    amount: Number,
    ref: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const savingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    emoji: { type: String, default: '🌽' },
    targetAmount: { type: Number, default: 0 }, // 0 = no target
    balance: { type: Number, default: 0, min: 0 }, // money currently locked in this plan
    totalDeposited: { type: Number, default: 0 },
    maturityDate: { type: Date, required: true }, // locked until this date
    frequency: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    autoAmount: { type: Number, default: 0 },
    autoEnabled: { type: Boolean, default: false },
    nextRunAt: { type: Date, default: null },
    missedRuns: { type: Number, default: 0 },
    penaltyRate: { type: Number, default: 0.1 }, // snapshot at creation: 10% early-withdrawal fee
    interestRatePA: { type: Number, default: 0 }, // snapshot at creation (0.08 = 8% a year). 0 = none
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    closedAt: Date,
    clientRef: String, // lets a retried "create" return the same plan instead of making a second one
    transactions: [txSchema],
  },
  { timestamps: true }
);

savingSchema.index({ status: 1, autoEnabled: 1, nextRunAt: 1 });
savingSchema.index({ user: 1, clientRef: 1 }, { unique: true, partialFilterExpression: { clientRef: { $type: 'string' } } });

export default mongoose.model('Saving', savingSchema);