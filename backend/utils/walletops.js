import User from '../models/User.js';

/* Small, safe building blocks for anything that takes money out of a wallet. */

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// a positive amount rounded to kobo, or null
export const parseAmount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
};

// the app sends a random id per payment attempt, so a retry can never pay twice
export const cleanRef = (v) => String(v ?? '').replace(/[^\w-]/g, '').slice(0, 40);

export const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

export async function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Take `amount` out of the wallet in ONE atomic step (it only happens if the balance is still
 * enough, and never twice for the same reference), and write a "pending" line in the history.
 * Returns the user, or null if the balance was too low.
 */
export function reserveFunds({ userId, amount, provider, reference, details }) {
  return User.findOneAndUpdate(
    { _id: userId, 'wallet.balance': { $gte: amount }, 'wallet.transactions.reference': { $ne: reference } },
    {
      $inc: { 'wallet.balance': -amount },
      $push: {
        'wallet.transactions': {
          type: 'debit', amount, provider, reference, status: 'pending', details, timestamp: new Date(),
        },
      },
    },
    { new: true, projection: { 'wallet.balance': 1 } }
  );
}

// pending -> success (only if it is still pending)
export const settleDebit = (userId, reference, status = 'success') =>
  User.updateOne(
    { _id: userId, 'wallet.transactions': { $elemMatch: { reference, status: 'pending' } } },
    { $set: { 'wallet.transactions.$.status': status } }
  );

// pending -> failed AND the money goes back, in the same single update.
// If it was already settled or refunded, nothing happens, so a refund can never be paid twice.
export async function refundDebit(userId, amount, reference) {
  const r = await User.updateOne(
    { _id: userId, 'wallet.transactions': { $elemMatch: { reference, status: 'pending' } } },
    { $inc: { 'wallet.balance': amount }, $set: { 'wallet.transactions.$.status': 'failed' } }
  );
  return r.modifiedCount === 1;
}