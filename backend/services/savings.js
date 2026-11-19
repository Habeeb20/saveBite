import User from '../models/User.js';
import Saving from '../models/wallet/savingsModel.js';

export const PENALTY_RATE = Number(process.env.SAVINGS_PENALTY_RATE ?? 0.1); // 10%
export const INTEREST_PA = Number(process.env.SAVINGS_INTEREST_PA ?? 0); // e.g. 0.08. Leave 0 unless you fund it.
export const LIMITS = { minAmount: 100, minDays: 7, maxDays: 1825, maxPlans: 10 };
const DAY = 86400000;
const FREQUENCIES = ['none', 'daily', 'weekly', 'monthly'];

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export class SavingsError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/* ------------------------------ pure helpers ------------------------------ */

export const isMatured = (plan, now = new Date()) => now >= new Date(plan.maturityDate);
export const penaltyFor = (amount, rate = PENALTY_RATE) => round2(amount * rate);

export function interestFor(plan, amount, now = new Date()) {
  const rate = plan.interestRatePA || 0;
  if (!rate) return 0;
  const end = Math.min(now.getTime(), new Date(plan.maturityDate).getTime());
  const days = Math.max(0, (end - new Date(plan.createdAt).getTime()) / DAY);
  return round2((amount * rate * days) / 365);
}

export function addPeriod(date, frequency) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); // Jan 31 -> Feb 28
  } else return null;
  return d;
}

// the next scheduled time strictly after `now` (skips runs that were missed while the server was down)
export function nextAfter(date, frequency, now = new Date()) {
  let d = addPeriod(date, frequency);
  for (let i = 0; d && d <= now && i < 1000; i++) d = addPeriod(d, frequency);
  return d;
}

export function previewWithdrawal(plan, amount, now = new Date()) {
  const matured = isMatured(plan, now);
  const penalty = matured ? 0 : penaltyFor(amount, plan.penaltyRate);
  const interest = matured ? interestFor(plan, amount, now) : 0;
  return { matured, amount, penalty, interest, payout: round2(amount - penalty + interest), penaltyRate: plan.penaltyRate };
}

/* ---------------------------- wallet bookkeeping ---------------------------- */

async function creditWallet(userId, amount, reference, details) {
  return User.updateOne(
    { _id: userId, 'wallet.transactions.reference': { $ne: reference } }, // never credits the same reference twice
    {
      $inc: { 'wallet.balance': amount },
      $push: {
        'wallet.transactions': {
          type: 'credit', amount, provider: 'savings', reference, status: 'success',
          details: { service: 'savings', ...details }, timestamp: new Date(),
        },
      },
    }
  );
}

async function giveBack(userId, amount, reference, note) {
  try {
    await creditWallet(userId, amount, reference, { type: 'savings_reversal', note });
  } catch (e) {
    console.error('CRITICAL: could not return money to wallet, fix by hand:', { userId: String(userId), amount, reference }, e);
  }
}

/* --------------------------------- actions --------------------------------- */

// wallet -> savings plan. Safe to repeat with the same `ref`.
export async function deposit({ userId, planId, amount, ref, auto = false }) {
  amount = round2(amount);
  if (!(amount >= LIMITS.minAmount)) throw new SavingsError(`The minimum is ₦${LIMITS.minAmount}`);

  const plan = await Saving.findOne({ _id: planId, user: userId });
  if (!plan) throw new SavingsError('Savings plan not found', 404);
  if (plan.status !== 'active') throw new SavingsError('This plan is closed');
  if (isMatured(plan)) throw new SavingsError('This plan has matured. Withdraw it, or start a new plan.');

  const walletRef = `${ref}-W`;
  if (await User.exists({ _id: userId, 'wallet.transactions.reference': walletRef })) {
    return Saving.findById(planId); // this exact request already went through
  }

  // 1) take the money out of the wallet, only if there is enough (one atomic step)
  const debited = await User.findOneAndUpdate(
    { _id: userId, 'wallet.balance': { $gte: amount }, 'wallet.transactions.reference': { $ne: walletRef } },
    {
      $inc: { 'wallet.balance': -amount },
      $push: {
        'wallet.transactions': {
          type: 'debit', amount, provider: 'savings', reference: walletRef, status: 'success',
          details: { type: auto ? 'savings_auto' : 'savings_deposit', service: 'savings', plan: plan.title, planId: String(plan._id) },
          timestamp: new Date(),
        },
      },
    },
    { new: true, projection: { 'wallet.balance': 1 } }
  );
  if (!debited) throw new SavingsError('Insufficient wallet balance');

  // 2) put it in the plan. If that fails, return the money.
  try {
    const updated = await Saving.findOneAndUpdate(
      { _id: planId, user: userId, status: 'active' },
      {
        $inc: { balance: amount, totalDeposited: amount },
        $push: { transactions: { type: auto ? 'auto_deposit' : 'deposit', amount, ref, at: new Date() } },
      },
      { new: true }
    );
    if (!updated) throw new SavingsError('This plan is no longer active');
    return updated;
  } catch (e) {
    await giveBack(userId, amount, `${ref}-R`, 'Savings deposit reversed');
    throw e instanceof SavingsError ? e : new SavingsError('Could not complete the deposit. Your money was returned.', 500);
  }
}

// savings plan -> wallet. Before maturity the early-withdrawal fee is taken off.
export async function withdraw({ userId, planId, amount, ref }) {
  const plan = await Saving.findOne({ _id: planId, user: userId });
  if (!plan) throw new SavingsError('Savings plan not found', 404);
  if (plan.status !== 'active') throw new SavingsError('This plan is already closed');

  amount = amount == null || amount === '' ? plan.balance : round2(amount);
  if (!(amount > 0) || amount > plan.balance) throw new SavingsError('Enter an amount up to your savings balance');

  const now = new Date();
  const { matured, penalty, interest, payout } = previewWithdrawal(plan, amount, now);
  if (payout <= 0) throw new SavingsError('That amount is too small after the fee');

  const walletRef = `${ref}-W`;
  if (await User.exists({ _id: userId, 'wallet.transactions.reference': walletRef })) {
    return { plan: await Saving.findById(planId), payout, penalty, interest, matured, repeated: true };
  }

  const entries = [{ type: 'withdrawal', amount, ref, note: matured ? 'At maturity' : 'Early withdrawal', at: now }];
  if (penalty) entries.push({ type: 'penalty', amount: penalty, ref: `${ref}-P`, note: `${Math.round(plan.penaltyRate * 100)}% early withdrawal fee`, at: now });
  if (interest) entries.push({ type: 'interest', amount: interest, ref: `${ref}-I`, note: 'Interest earned', at: now });

  // 1) take it out of the plan (only if the balance is still there)
  const updated = await Saving.findOneAndUpdate(
    { _id: planId, user: userId, status: 'active', balance: { $gte: amount } },
    { $inc: { balance: -amount }, $push: { transactions: { $each: entries } } },
    { new: true }
  );
  if (!updated) throw new SavingsError('Your balance changed. Please try again.', 409);

  // 2) pay the wallet. If that fails, put everything back in the plan.
  try {
    await creditWallet(userId, payout, walletRef, {
      type: matured ? 'savings_payout' : 'savings_early_withdrawal',
      plan: plan.title, planId: String(plan._id), penalty, interest,
    });
  } catch (e) {
    await Saving.updateOne(
      { _id: planId },
      { $inc: { balance: amount }, $pull: { transactions: { ref: { $in: [ref, `${ref}-P`, `${ref}-I`] } } } }
    ).catch((err) => console.error('CRITICAL: savings rollback failed:', String(planId), ref, err));
    throw new SavingsError('Could not move your money. Nothing was changed.', 500);
  }

  // 3) an empty plan is finished
  let finalPlan = updated;
  if (updated.balance <= 0) {
    finalPlan = await Saving.findOneAndUpdate(
      { _id: planId, balance: { $lte: 0 } },
      { $set: { status: 'closed', closedAt: new Date(), autoEnabled: false, nextRunAt: null } },
      { new: true }
    ) || updated;
  }
  if (penalty) console.log(`SAVINGS FEE kept: ₦${penalty} (plan ${planId}, ref ${ref})`);
  return { plan: finalPlan, payout, penalty, interest, matured };
}

export async function createPlan({ userId, title, emoji, targetAmount, maturityDate, frequency = 'none', autoAmount = 0, initialDeposit = 0, clientRef }) {
  title = String(title ?? '').trim();
  if (title.length < 2 || title.length > 60) throw new SavingsError('Give your plan a name (2 to 60 characters)');

  const maturity = new Date(maturityDate);
  if (Number.isNaN(maturity.getTime())) throw new SavingsError('Choose when your savings should unlock');
  const days = (maturity.getTime() - Date.now()) / DAY;
  if (days < LIMITS.minDays) throw new SavingsError(`Lock your savings for at least ${LIMITS.minDays} days`);
  if (days > LIMITS.maxDays) throw new SavingsError('The longest lock is 5 years');

  if (!FREQUENCIES.includes(frequency)) throw new SavingsError('Invalid saving frequency');
  autoAmount = round2(autoAmount || 0);
  if (frequency !== 'none' && autoAmount < LIMITS.minAmount) throw new SavingsError(`Auto-save must be at least ₦${LIMITS.minAmount}`);
  const target = round2(targetAmount || 0);
  if (target && target < LIMITS.minAmount) throw new SavingsError('Enter a valid target amount');
  const initial = round2(initialDeposit || 0);
  if (initial && initial < LIMITS.minAmount) throw new SavingsError(`The first deposit must be at least ₦${LIMITS.minAmount}`);

  if (clientRef) {
    const dup = await Saving.findOne({ user: userId, clientRef });
    if (dup) return dup; // a retry of the same request
  }
  if ((await Saving.countDocuments({ user: userId, status: 'active' })) >= LIMITS.maxPlans) {
    throw new SavingsError(`You can have up to ${LIMITS.maxPlans} active plans`);
  }

  const now = new Date();
  const plan = await Saving.create({
    user: userId, title, emoji: emoji || '🌽', targetAmount: target, maturityDate: maturity,
    frequency, autoAmount: frequency === 'none' ? 0 : autoAmount, autoEnabled: frequency !== 'none',
    nextRunAt: frequency === 'none' ? null : addPeriod(now, frequency),
    penaltyRate: PENALTY_RATE, interestRatePA: INTEREST_PA, clientRef,
  });

  if (initial > 0) {
    try {
      return await deposit({ userId, planId: plan._id, amount: initial, ref: `SAV-${clientRef || plan._id}-I` });
    } catch (e) {
      await Saving.deleteOne({ _id: plan._id, balance: 0 }); // don't leave an empty plan behind
      throw e;
    }
  }
  return plan;
}

export async function updatePlan({ userId, planId, patch }) {
  const plan = await Saving.findOne({ _id: planId, user: userId, status: 'active' });
  if (!plan) throw new SavingsError('Savings plan not found', 404);
  const set = {};

  if (patch.title !== undefined) {
    const t = String(patch.title).trim();
    if (t.length < 2 || t.length > 60) throw new SavingsError('Give your plan a name (2 to 60 characters)');
    set.title = t;
  }
  if (patch.emoji) set.emoji = String(patch.emoji).slice(0, 8);
  if (patch.targetAmount !== undefined) {
    const t = round2(patch.targetAmount || 0);
    if (t && t < LIMITS.minAmount) throw new SavingsError('Enter a valid target amount');
    set.targetAmount = t;
  }
  if (patch.maturityDate !== undefined) {
    const m = new Date(patch.maturityDate);
    if (Number.isNaN(m.getTime())) throw new SavingsError('Invalid date');
    if (m <= plan.maturityDate) throw new SavingsError('You can extend the lock, but not shorten it');
    if ((m - plan.createdAt) / DAY > LIMITS.maxDays) throw new SavingsError('The longest lock is 5 years');
    set.maturityDate = m;
  }

  if (patch.frequency !== undefined && !FREQUENCIES.includes(patch.frequency)) throw new SavingsError('Invalid saving frequency');
  const frequency = patch.frequency ?? plan.frequency;
  const autoAmount = patch.autoAmount !== undefined ? round2(patch.autoAmount) : plan.autoAmount;
  const enabled = patch.autoEnabled !== undefined ? !!patch.autoEnabled : plan.autoEnabled;
  if (enabled && frequency === 'none') throw new SavingsError('Choose how often to save');
  if (enabled && autoAmount < LIMITS.minAmount) throw new SavingsError(`Auto-save must be at least ₦${LIMITS.minAmount}`);

  set.frequency = frequency;
  set.autoAmount = autoAmount;
  set.autoEnabled = enabled && frequency !== 'none';
  if (!set.autoEnabled) set.nextRunAt = null;
  else if (!plan.autoEnabled || patch.frequency !== undefined) set.nextRunAt = addPeriod(new Date(), frequency);

  return Saving.findByIdAndUpdate(planId, { $set: set }, { new: true });
}

/* ------------------------------- auto-saving ------------------------------- */

// Called every few minutes. Each due plan is "claimed" atomically first, so two servers (or two
// overlapping runs) can never save for the same plan twice. The reference is fixed per scheduled
// slot, so even a crash-and-retry cannot double-charge.
export async function runDueAutoSaves(limit = 500) {
  let saved = 0;
  let missed = 0;
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const plan = await Saving.findOneAndUpdate(
      { status: 'active', autoEnabled: true, nextRunAt: { $lte: now }, maturityDate: { $gt: now } },
      { $set: { nextRunAt: new Date(now.getTime() + 60 * 60 * 1000) } }, // 1-hour lease while we work on it
      { new: false }
    );
    if (!plan) break;

    const slot = new Date(plan.nextRunAt).toISOString().slice(0, 10);
    const ref = `SAVA-${plan._id}-${slot}`;
    const next = nextAfter(plan.nextRunAt, plan.frequency, now);
    try {
      await deposit({ userId: plan.user, planId: plan._id, amount: plan.autoAmount, ref, auto: true });
      await Saving.updateOne({ _id: plan._id }, { $set: { nextRunAt: next } });
      saved++;
    } catch (e) {
      missed++;
      await Saving.updateOne(
        { _id: plan._id },
        {
          $set: { nextRunAt: next },
          $inc: { missedRuns: 1 },
          $push: { transactions: { type: 'auto_missed', amount: plan.autoAmount, ref, note: e.message, at: now } },
        }
      ).catch(() => {});
    }
  }
  return { saved, missed };
}