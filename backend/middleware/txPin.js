import User from '../models/User.js';
import { checkPin, isValidPin } from '../utils/txPin.js';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Checks a PIN for a user and keeps count of wrong tries (5 wrong = locked for 15 minutes).
 * -> { ok: true } | { ok: false, status, body }
 * (403, not 401, on purpose: 401 usually makes apps sign the user out.)
 */
export async function verifyTxPin(userId, pin) {
  const user = await User.findById(userId).select('txPin');
  if (!user?.txPin?.hash) return { ok: false, status: 428, body: { code: 'PIN_NOT_SET', error: 'Create a transaction PIN first' } };

  if (user.txPin.lockedUntil && user.txPin.lockedUntil > new Date()) {
    const mins = Math.ceil((user.txPin.lockedUntil - Date.now()) / 60000);
    return { ok: false, status: 423, body: { code: 'PIN_LOCKED', error: `Too many wrong PINs. Try again in ${mins} min.` } };
  }
  if (!isValidPin(pin)) return { ok: false, status: 400, body: { code: 'PIN_REQUIRED', error: 'Enter your 4-digit transaction PIN' } };

  if (await checkPin(pin, user.txPin.hash)) {
    if (user.txPin.fails) await User.updateOne({ _id: user._id }, { $set: { 'txPin.fails': 0 } });
    return { ok: true };
  }

  const after = await User.findByIdAndUpdate(user._id, { $inc: { 'txPin.fails': 1 } }, { new: true }).select('txPin');
  const fails = after?.txPin?.fails ?? 1;
  if (fails >= MAX_FAILS) {
    await User.updateOne({ _id: user._id }, { $set: { 'txPin.fails': 0, 'txPin.lockedUntil': new Date(Date.now() + LOCK_MS) } });
    return { ok: false, status: 423, body: { code: 'PIN_LOCKED', error: 'Too many wrong PINs. Try again in 15 min.' } };
  }
  return { ok: false, status: 403, body: { code: 'PIN_INVALID', error: `Wrong PIN. ${MAX_FAILS - fails} tries left` } };
}

// Put AFTER `protect` on any route that moves money. The app sends { pin: "1234" } in the body.
export const requireTxPin = async (req, res, next) => {
  try {
    const pin = String(req.body?.pin ?? '');
    if (req.body) delete req.body.pin; // never let the PIN reach controllers or their console.log(req.body)
    const r = await verifyTxPin(req.user._id, pin);
    return r.ok ? next() : res.status(r.status).json(r.body);
  } catch (e) {
    next(e);
  }
};

// only ask for the PIN when money is actually being moved (e.g. creating a plan WITH a first deposit)
export const requireTxPinIf = (test) => (req, res, next) => (test(req) ? requireTxPin(req, res, next) : next());