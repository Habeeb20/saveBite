import Saving from '../models/wallet/savingsModel.js';
import {
  LIMITS, PENALTY_RATE, INTEREST_PA, SavingsError, createPlan, deposit, isMatured,
  previewWithdrawal, updatePlan, withdraw,
} from '../services/savings.js';

const DAY = 86400000;

const planView = (p, { withTx = false } = {}) => {
  const now = new Date();
  const matured = isMatured(p, now);
  return {
    _id: String(p._id),
    title: p.title, emoji: p.emoji,
    targetAmount: p.targetAmount, balance: p.balance, totalDeposited: p.totalDeposited,
    progress: p.targetAmount ? Math.min(1, p.balance / p.targetAmount) : null,
    maturityDate: p.maturityDate, matured,
    daysLeft: matured ? 0 : Math.ceil((new Date(p.maturityDate) - now) / DAY),
    frequency: p.frequency, autoAmount: p.autoAmount, autoEnabled: p.autoEnabled,
    nextRunAt: p.nextRunAt, missedRuns: p.missedRuns,
    penaltyRate: p.penaltyRate, interestRatePA: p.interestRatePA,
    status: p.status, createdAt: p.createdAt, closedAt: p.closedAt,
    ...(withTx && { transactions: [...(p.transactions || [])].reverse().slice(0, 60) }),
  };
};

const run = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof SavingsError) return res.status(e.status).json({ error: e.message });
    console.error('savings error:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

const refOf = (req, prefix) => `${prefix}-${String(req.body?.clientRef || '').replace(/[^\w-]/g, '').slice(0, 40) || `${Date.now()}${Math.random().toString(36).slice(2, 8)}`}`;

export const config = run(async (req, res) => {
  res.json({ penaltyRate: PENALTY_RATE, interestRatePA: INTEREST_PA, ...LIMITS });
});

export const list = run(async (req, res) => {
  const plans = await Saving.find({ user: req.user._id }).sort({ status: 1, maturityDate: 1 }).lean();
  const active = plans.filter((p) => p.status === 'active');
  const now = new Date();
  res.json({
    plans: plans.map((p) => planView(p)),
    summary: {
      totalSaved: active.reduce((s, p) => s + p.balance, 0),
      activePlans: active.length,
      lockedAmount: active.filter((p) => now < p.maturityDate).reduce((s, p) => s + p.balance, 0),
      readyAmount: active.filter((p) => now >= p.maturityDate).reduce((s, p) => s + p.balance, 0),
    },
  });
});

export const create = run(async (req, res) => {
  const b = req.body;
  const plan = await createPlan({
    userId: req.user._id, title: b.title, emoji: b.emoji, targetAmount: b.targetAmount,
    maturityDate: b.maturityDate, frequency: b.frequency, autoAmount: b.autoAmount,
    initialDeposit: b.initialDeposit, clientRef: b.clientRef ? String(b.clientRef).slice(0, 60) : undefined,
  });
  res.status(201).json({ plan: planView(plan, { withTx: true }) });
});

export const get = run(async (req, res) => {
  const plan = await Saving.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!plan) throw new SavingsError('Savings plan not found', 404);
  res.json({ plan: planView(plan, { withTx: true }) });
});

export const update = run(async (req, res) => {
  const plan = await updatePlan({ userId: req.user._id, planId: req.params.id, patch: req.body });
  res.json({ plan: planView(plan, { withTx: true }) });
});

export const addMoney = run(async (req, res) => {
  const plan = await deposit({ userId: req.user._id, planId: req.params.id, amount: req.body.amount, ref: refOf(req, 'SAVD') });
  res.json({ plan: planView(plan, { withTx: true }) });
});

// what a withdrawal would cost, so the app can show the fee BEFORE the user confirms
export const preview = run(async (req, res) => {
  const plan = await Saving.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!plan || plan.status !== 'active') throw new SavingsError('Savings plan not found', 404);
  const amount = req.query.amount ? Number(req.query.amount) : plan.balance;
  if (!(amount > 0) || amount > plan.balance) throw new SavingsError('Enter an amount up to your savings balance');
  res.json({ ...previewWithdrawal(plan, amount), balance: plan.balance, maturityDate: plan.maturityDate });
});

export const takeOut = run(async (req, res) => {
  const out = await withdraw({ userId: req.user._id, planId: req.params.id, amount: req.body.amount, ref: refOf(req, 'SAVW') });
  res.json({
    plan: planView(out.plan, { withTx: true }),
    payout: out.payout, penalty: out.penalty, interest: out.interest, matured: out.matured,
  });
});