









import crypto from 'crypto';
import fetch from 'node-fetch';
import User from '../models/User.js';
import Transfer from '../models/wallet/transferModel.js';
import { NIGERIAN_BANKS } from '../utils/banks.js';

const PAYLONY_TRANSFER_URL = 'https://api.paylony.com/api/v1/bank_transfer';
const PAYLONY_VERIFY_URL = 'https://api.paylony.com/api/v1/account_name';
const bankByCode = new Map(NIGERIAN_BANKS.map((b) => [b.code, b]));
// Read lazily: ES module imports run before dotenv.config() in many setups.
const secretKey = () => process.env.PAYLONY_SECRET_KEY;
const encryptionKey = () => process.env.PAYLONY_ENCRYPTION_KEY;


/**
 * Paylony requires: payload keys sorted alphabetically -> HMAC-SHA512 with your
 * Encryption Key -> hex digest sent in the `Signature` header.
 * We sign the EXACT string we send as the body, so they can never differ.
 */
const buildSignedRequest = (payload) => {
  const sorted = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

  const body = JSON.stringify(sorted);
  const signature = crypto
    .createHmac('sha512', encryptionKey())
    .update(body)
    .digest('hex');

  return { body, signature };
};

const refundWallet = (userId, amount) =>
  User.updateOne({ _id: userId }, { $inc: { 'wallet.balance': amount } });

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

/**
 * @swagger
 * /api/transfer/transferfunds:
 *   post:
 *     summary: Transfer funds from wallet to an external bank account via Paylony
 *     description: >
 *       Atomically debits the wallet, creates a pending Transfer record, then calls
 *       Paylony's bank_transfer API with an HMAC-SHA512 Signature header.
 *       Definite failures (4xx / success=false) are refunded automatically.
 *       Ambiguous outcomes (network error, timeout, 5xx) stay pending for reconciliation.
 *     tags: [Transfer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [account_number, amount, bank_code, narration]
 *             properties:
 *               account_number: { type: string, example: "0123456789" }
 *               amount: { type: number, example: 10000 }
 *               narration: { type: string, example: "Payment for services" }
 *               bank_code: { type: string, example: "044" }
 *     responses:
 *       200:
 *         description: Transfer successful
 *       202:
 *         description: Transfer submitted but status unconfirmed (pending)
 *       400:
 *         description: Validation error, insufficient balance, or Paylony rejected the transfer
 *       500:
 *         description: Server error
 */
export const transferFunds = async (req, res) => {
  let transfer;
  let debited = false;
  let userId;
  let parsedAmount;

  try {
    const { amount, narration } = req.body;
    // Strings only: a number would lose the leading zeros in "000013"
    const account_number = String(req.body?.account_number ?? '').trim();
    const bank_code = String(req.body?.bank_code ?? '').trim();
    const account_name = String(req.body?.account_name ?? '').trim();

    if (!account_number || !bank_code) {
      return res.status(400).json({ error: 'Account number and bank code are required' });
    }
    if (!/^\d{10}$/.test(account_number)) {
      return res.status(400).json({ error: 'Account number must be 10 digits' });
    }
    if (!narration || !String(narration).trim()) {
      return res.status(400).json({ error: 'Narration is required' });
    }
    if (!bankByCode.has(bank_code)) {
      return res.status(400).json({ error: 'This bank is not supported for transfers' });
    }

    parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    parsedAmount = Math.round(parsedAmount * 100) / 100;

    if (!encryptionKey() || !secretKey()) {
      console.error('Paylony keys missing (PAYLONY_SECRET_KEY / PAYLONY_ENCRYPTION_KEY)');
      return res.status(500).json({ error: 'Transfer service not configured' });
    }

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    userId = user._id;

    const sender_name = user.first_name || user.fullName;
    if (!sender_name) {
      return res.status(400).json({ error: 'Sender name not found' });
    }

    const reference = `ESS${Date.now()}${crypto.randomBytes(4).toString('hex')}`;

    transfer = await Transfer.create({
      userId,
      amount: parsedAmount,
      account_number,
      account_name,

      bank_code,
      narration: String(narration).trim(),
      ref: reference,
      status: 'pending',
    });

    // Atomic debit: only succeeds if balance is still sufficient (no race conditions)
    const debitedUser = await User.findOneAndUpdate(
      { _id: userId, 'wallet.balance': { $gte: parsedAmount } },
      { $inc: { 'wallet.balance': -parsedAmount } },
      { new: true }
    );
    if (!debitedUser) {
      transfer.status = 'failed';
      await transfer.save();
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    debited = true;

    // Payload exactly as documented by Paylony
    const { body, signature } = buildSignedRequest({
      account_number,
      account_name,

      amount: String(parsedAmount),
      bank_code,
      narration: String(narration).trim(),
      reference,
      sender_name: String(sender_name),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(PAYLONY_TRANSFER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey()}`,
          'Content-Type': 'application/json',
          Signature: signature,
        },
        body,
        signal: controller.signal,
      });
    } catch (networkErr) {
      // Unknown outcome: money may have left. Do NOT auto-refund; flag for reconciliation.
      console.error('Paylony network error (outcome unknown):', reference, networkErr.message);
      return res.status(202).json({
        message: 'Transfer submitted but not yet confirmed. It will be reviewed shortly.',
        reference,
        status: 'pending',
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await safeJson(response);

    // 5xx = ambiguous, keep pending
    if (response.status >= 500) {
      console.error('Paylony 5xx (outcome unknown):', reference, response.status, data);
      return res.status(202).json({
        message: 'Transfer submitted but not yet confirmed. It will be reviewed shortly.',
        reference,
        status: 'pending',
      });
    }

    // Definite failure: 4xx or explicit success=false -> refund
    if (!response.ok || data.success === false) {
      await refundWallet(userId, parsedAmount);
      debited = false;
      transfer.status = 'failed';
      await transfer.save();
      console.error('Paylony rejected transfer:', reference, response.status, data);
      return res.status(400).json({
        error: data.message || `Transfer rejected (${response.status})`,
      });
    }

    // Success
    transfer.status = 'success';
    await transfer.save();
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          'wallet.transactions': {
            type: 'debit',
            amount: parsedAmount,
            provider: 'paylony',
            reference,
            status: 'success',
            details: { account_number, bank_code, type: 'transfer' },
            timestamp: new Date(),
          },
        },
      }
    );

    return res.json({ message: 'Transfer successful', amount: parsedAmount, reference });
  } catch (error) {
    console.error('Transfer error:', error);
    // Unexpected error before the Paylony call completed: safe to refund
    if (debited && userId && parsedAmount) {
      try {
        await refundWallet(userId, parsedAmount);
        if (transfer) {
          transfer.status = 'failed';
          await transfer.save();
        }
      } catch (rollbackErr) {
        console.error('ROLLBACK FAILED, manual fix needed:', transfer?.ref, rollbackErr);
      }
    }
    return res.status(500).json({ error: `Transfer failed: ${error.message}` });
  }
};
// Only banks Paylony supports transfers to, for the client's bank picker.
// export const getBanks = async (req, res) => {
//   try {
//     const banks = NIGERIAN_BANKS
//       .filter((b) => PAYLONY_WHITELIST.includes(b.code))
//       .map((b) => ({ name: b.name, code: b.code }));
//     res.json({ banks });
//   } catch (error) {
//     console.log(error)
//     res.status(500).json({ error: 'Failed to fetch banks' });
//   }
// };

export const getBanks = async (req, res) => {
  try {
    const banks = NIGERIAN_BANKS.map(({ name, code }) => ({
      name,
      code: String(code), // keep as string so leading zeros survive
    }));

    res.json({ banks });
  } catch (error) {
    console.error('getBanks error:', error);
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
};

/**
 * @swagger
 * /api/transfer/verify-account:
 *   post:
 *     summary: Verify a bank account name before transferring funds
 *     description: Only supports banks in .
 *     tags: [Transfer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bank_code, account_number]
 *             properties:
 *               bank_code: { type: string, example: "058" }
 *               account_number: { type: string, example: "0123456789" }
 *     responses:
 *       200:
 *         description: Account verified
 *       400:
 *         description: Missing fields, unsupported bank, or invalid account
 *       500:
 *         description: Service temporarily unavailable
 */
// Lookup by Paylony code. Codes are strings: leading zeros matter ("000013").


const extractAccount = (payload) => {
  // Paylony shape: { success, status, message: "Account Found", data: "ACCOUNT HOLDER NAME" }
  if (typeof payload?.data === 'string' && payload.data.trim()) {
    return { account_name: payload.data.trim(), account_number: null };
  }

  // Fallbacks in case the shape ever becomes an object
  const d = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return {
    account_name: d?.account_name || d?.accountName || d?.name || null,
    account_number: d?.account_number || d?.accountNumber || null,
  };
};

export const verifyAccount = async (req, res) => {
  try {
    const bank_code = String(req.body?.bank_code ?? '').trim();
    const account_number = String(req.body?.account_number ?? '').trim();

    if (!bank_code || !account_number) {
      return res.status(400).json({ error: 'Bank code and account number required' });
    }
    if (!/^\d{10}$/.test(account_number)) {
      return res.status(400).json({ error: 'Account number must be 10 digits' });
    }
    if (!secretKey()) {
      console.error('PAYLONY_SECRET_KEY missing');
      return res.status(500).json({ error: 'Verification service not configured' });
    }

    const bank = bankByCode.get(bank_code);
    if (!bank) {
      return res.status(400).json({ error: 'Invalid or unsupported bank selected' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(PAYLONY_VERIFY_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ bank_code, account_number }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await safeJson(response);
    console.log('Paylony account_name raw:', response.status, JSON.stringify(data));
    const acct = extractAccount(data);

    if (!response.ok || data.success === false || !acct.account_name) {
      return res.status(400).json({
        error: data.message || 'Invalid account number or bank not supported',
      });
    }


    if (!acct.account_name) {
      console.error('Paylony verified the account but no name was found in the response');
      return res.status(502).json({ error: 'Could not read account name from provider' });
    }
    return res.json({
      account_name: acct.account_name,
      account_number: acct.account_number || account_number,
      bank_name: bank.name,
      bank_code,
    });
  } catch (err) {
    console.error('Account verification error:', err);
    const timedOut = err.name === 'AbortError';
    return res.status(timedOut ? 504 : 500).json({
      error: timedOut ? 'Verification timed out, try again' : 'Service temporarily unavailable',
    });
  }
};















