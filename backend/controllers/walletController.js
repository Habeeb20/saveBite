

import User from '../models/User.js';
import Airtime from '../models/wallet/airtimeModel.js';
import axios from 'axios';
import dotenv from 'dotenv';
import Data from '../models/wallet/dataModel.js';
import Electricty from "../models/wallet/electrictyModel.js"
import Tv from '../models/wallet/tvModel.js';
import crypto from "crypto"
import mongoose from 'mongoose';
import Saving from '../models/wallet/savingsModel.js';
import { hashPin, isValidPin } from '../utils/txPin.js';
import { verifyTxPin } from '../middleware/txPin.js';
dotenv.config();

const MCD_API_URL = 'https://reseller.mcd.5starcompany.com.ng/api/v1';
const MCD_API_TOKEN = process.env.MCD_API_TOKEN;
const MCD_TOKEN = process.env.MCD_TOKEN
const BILL_TYPES = new Set(['airtime', 'data', 'data_pin', 'electricty-bill', 'electricity', 'tv_subscription']);






/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const PAYLONY_API_URL = (process.env.PAYLONY_API_URL || 'https://api.paylony.com/api/v1').replace(
  /[;\s/]+$/,
  ''
);

const paylonyHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYLONY_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */


// what kind of activity is this? (drives the filters on the history screen)
export const kindOf = (t) => {
  const d = t.details?.type || '';
  if (d.startsWith('savings')) return 'savings';
  if (BILL_TYPES.has(d)) return 'bills';
  if (d === 'transfer') return 'transfer';
  return t.type === 'credit' ? 'in' : 'out';
};

const accountOf = (u) => {
  const p = u.paylonyVirtualAccountDetails;
  const v = u.virtualAccountDetails;
  if (p?.account_number) return { number: p.account_number, name: p.account_name, bank: p.bank_name };
  if (v?.account_number) return { number: v.account_number, name: v.account_name, bank: v.bank };
  return null;
};

const visibleTx = (u) => (u.wallet?.transactions || []).filter((t) => t.type !== 'balance_check');

// Rounds to 2 decimal places to avoid floating point drift (e.g. 0.1 + 0.2)
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Returns a positive, rounded number or null if the input is not a valid amount
const parseAmount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
};

const safeDate = (value) => {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

// Constant-time string comparison (prevents timing attacks on secrets/signatures)
const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};



export const fetchWalletBalance = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: user.wallet.balance });
  } catch (error) {
    console.error('Fetch wallet balance error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet balance' });
  }
};


export const buyAirtime = async (req, res) => {
  try {
    const { network, amount, phone, country, promo = '0' } = req.body;
    const provider = network ? String(network).toLowerCase() : network
    const number = phone
    console.log(req.body)
    console.log(provider, "your provider")
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate input
    if (!provider || !amount || !number ) {
      console.log("missing fields here")
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (user.wallet.balance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Generate unique reference
    const reference = `mcd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existingAirtime = await Airtime.findOne({ ref: reference });
    if (existingAirtime) {
      return res.status(400).json({ error: 'Duplicate transaction reference' });
    }

    // Validate phone number/service (using /validate endpoint)
    const validateResponse = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'airtime',
        provider,
        number,
      }),
    });

    if (!validateResponse.ok) {
      throw new Error(`Validation failed: ${validateResponse.status}`);
    }

    // Create airtime transaction record (pending)
    const airtime = new Airtime({
      userId: user._id,
      provider,
      amount: parsedAmount,
      number,
      country: 'NGN',
      payment: 'wallet',
      promo,
      ref: reference,
      operatorID: 0,
      type: 'airtime',
      status: 'pending',
    });
    await airtime.save();

    // Deduct amount from wallet
    user.wallet.balance -= parsedAmount;
    await user.save();

    // Call MCD Reseller API for airtime
    const response = await fetch(`${MCD_API_URL}/airtime`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        amount: parsedAmount.toString(),
        number,
        country:'NG',
        payment: 'wallet',
        promo,
        ref: reference,
        operatorID: 0,
      }),
    });

    if (!response.ok) {
      // Roll back wallet balance and update transaction status
      user.wallet.balance += parsedAmount;
      airtime.status = 'failed';
      await Promise.all([user.save(), airtime.save()]);
      throw new Error(`MCD API error: ${response.status}`);
    }

  
    const result = await response.json();
console.log(result)
    // Update transaction status and log to user wallet
    airtime.status = 'success';
    await airtime.save();

    user.wallet.transactions.push({
      type: 'debit',
      amount: parsedAmount,
      provider: 'mcd',
      reference,
      status: 'success',
      details: { provider, number, country, type: 'airtime' },
      timestamp: new Date(),
    });
    await user.save();

    res.json({ success: true, message: 'Airtime purchase successful', reference });
  } catch (error) {
    console.error('Airtime purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase airtime' });
  }
};


export const buyDataPin = async (req, res) => {
  try {
    const { provider: rawProvider, amount, number, country, promo = '0' } = req.body;
    const provider = rawProvider ? String(rawProvider).toLowerCase() : rawProvider;
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate input
    if (!provider || !amount || !number || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (user.wallet.balance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Generate unique reference
    const reference = `mcd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existingAirtime = await Airtime.findOne({ ref: reference });
    if (existingAirtime) {
      return res.status(400).json({ error: 'Duplicate transaction reference' });
    }

    // Validate phone number/service (using /validate endpoint)
    const validateResponse = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'data',
        provider,
        number,
      }),
    });

    if (!validateResponse.ok) {
      throw new Error(`Validation failed: ${validateResponse.status}`);
    }

    const validateResult = await validateResponse.json();
    if (!validateResult.success) {
      return res.status(400).json({ error: validateResult.message || 'Invalid phone number or provider' });
    }

    // Create airtime transaction record (pending)
    const airtime = new Airtime({
      userId: user._id,
      provider,
      amount: parsedAmount,
      number,
      country,
      payment: 'wallet',
      promo,
      ref: reference,
      operatorID: 0,
      type: 'data_pin',
      status: 'pending',
    });
    await airtime.save();

    // Deduct amount from wallet
    user.wallet.balance -= parsedAmount;
    await user.save();

    // Call MCD Reseller API for data (assuming /data endpoint)
    const response = await fetch(`${MCD_API_URL}/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        amount: parsedAmount.toString(),
        number,
        country,
        payment: 'wallet',
        promo,
        ref: reference,
        operatorID: 0,
      }),
    });

    if (!response.ok) {
      // Roll back wallet balance and update transaction status
      user.wallet.balance += parsedAmount;
      airtime.status = 'failed';
      await Promise.all([user.save(), airtime.save()]);
      throw new Error(`MCD API error: ${response.status}`);
    }

    const result = await response.json();

    // Update transaction status and log to user wallet
    airtime.status = 'success';
    await airtime.save();

    user.wallet.transactions.push({
      type: 'debit',
      amount: parsedAmount,
      provider: 'mcd',
      reference,
      status: 'success',
      details: { provider, number, country, type: 'data_pin' },
      timestamp: new Date(),
    });
    await user.save();

    res.json({ success: true, message: 'Data pin purchase successful', reference });
  } catch (error) {
    console.error('Data pin purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase data pin' });
  }
};





export const buyData = async (req, res) => {
  try {
    const {  coded, number,   reseller_price } = req.body;
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log(req.body)
    
    if (!coded || !number || !reseller_price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const parsedAmount = parseFloat(reseller_price);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid reseller price' });
    }
    if (user.wallet.balance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const  provider= coded.split('_')[0].toLowerCase()
    const country = "NG"

   

    // Generate unique reference
    const reference = `mcd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existingData = await Data.findOne({ ref: reference }); // Updated to Data
    if (existingData) {
      return res.status(400).json({ error: 'Duplicate transaction reference' });
    }

    // Validate phone number/service (using /validate endpoint)
    const validateResponse = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'data',
        provider,
        number,
      }),
    });

    if (!validateResponse.ok) {
      console.log(validateResponse)
      throw new Error(`Validation failed: ${validateResponse.status}`);
    }
   
    // Create data transaction record (pending)
    const data = new Data({ // Updated to Data
      userId: user._id,
      coded,
      provider: coded.split('_')[0], // Store provider part of coded
      number,
      country: "NG",
      payment: 'wallet',
      promo: "0",
      ref: reference,
      reseller_price: parsedAmount,
      status: 'pending',
    });
    await data.save();

    // Deduct amount from wallet
    user.wallet.balance -= parsedAmount;
    await user.save();

    // Call MCD Reseller API for data
    const response = await fetch(`${MCD_API_URL}/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coded,
        number,
        payment: 'wallet',
        promo:"0",
        ref: reference,
        country: "NG",
        reseller_price: parsedAmount.toString(),
      }),
    });

    if (!response.ok) {
      // Roll back wallet balance and update transaction status
      user.wallet.balance += parsedAmount;
      data.status = 'failed'; // Updated to data
      await Promise.all([user.save(), data.save()]);
      throw new Error(`MCD API error: ${response.status}`);
    }

    const result = await response.json();

    // Update transaction status and log to user wallet
    data.status = 'success'; // Updated to data
    data.dataPlanDetails = result.data || {}; // Store additional API response data
    await data.save();

    user.wallet.transactions.push({
      type: 'debit',
      amount: parsedAmount,
      provider: 'mcd',
      reference,
      status: 'success',
      details: { coded, number, country, type: 'data' },
      timestamp: new Date(),
    });
    await user.save();
console.log(result)
    res.json({ success: true, message: 'Data purchase successful', reference });
  } catch (error) {
    console.error('Data purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase data' });
  }
};





export const buyElectricity = async (req, res) => {
    try {
      const {number, amount} = req.body
       const user = await User.findOne({ email: req.user.email });
       if (!user) return res.status(404).json({ error: 'User not found' });

        if ( !number || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 500) {
      return res.status(400).json({ error: 'you cant buy below 500' });
    }
     if (user.wallet.balance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const provider = "ikeja-electric"
      const country = "NG"
      const promo = "0"
      const payment = "wallet"
      const reference = `mcd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const existingData = await Electricty.findOne({ ref: reference }); // Updated to Data
              if (existingData) {
                return res.status(400).json({ error: 'Duplicate transaction reference' });
              }

               // Validate phone number/service (using /validate endpoint)
    const validateResponse = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'airtime',
        provider,
        number,
      }),
    });

    if (!validateResponse.ok) {
      console.log(validateResponse)
      throw new Error(`Validation failed: ${validateResponse.status}`);
    }

    const electricity = new Electricty({
        userId: user._id,
        number,
        provider,
        amount: parsedAmount,
        ref: reference,
        promo,
        payment,
        country,
        status:"pending"

    })

    await electricity.save()

     user.wallet.balance -= parsedAmount;
    await user.save();


  const response = await fetch(`${MCD_API_URL}/electricity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number,
        provider,
        amount: parsedAmount,
        ref: reference,
        promo,
        payment,
        country,
      }),
    });
 

       if (!response.ok) {
      // Roll back wallet balance and update transaction status
      user.wallet.balance += parsedAmount;
      electricity.status = 'failed';
      await Promise.all([user.save(), electricity.save()]);
      throw new Error(`MCD API error: ${response.status}`);
    }

    const result = await response.json();

   electricity.status = "success";
   electricity.electricityDetails = result.data || {}

  await electricity.save()
 user.wallet.transactions.push({
      type: 'debit',
      amount: parsedAmount,
      provider: 'mcd',
      reference,
      status: 'success',
      details: { amount, number, country, type: 'electricty-bill' },
      timestamp: new Date(),
    });
    await user.save();
console.log(result)
    res.json({ success: true, message: 'Data purchase successful', reference });
    } catch (error) {
            console.error('Data purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase data' });
    }
}






export const tvSubscription= async (req, res) => {
  try {
    const {  coded, number, price  } = req.body;
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log(req.body)
    
    if (!coded || !number || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const parsedAmount = parseFloat(price);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid  price' });
    }
    if (user.wallet.balance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const  provider= coded.split('_')[0]
    const country = "NG"

   

    // Generate unique reference
    const reference = `mcd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existingData = await Tv.findOne({ ref: reference }); // Updated to Data
    if (existingData) {
      return res.status(400).json({ error: 'Duplicate transaction reference' });
    }

    // Validate phone number/service (using /validate endpoint)
    const validateResponse = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'tv-subscription',
        provider,
        number,
      }),
    });

    if (!validateResponse.ok) {
      console.log(validateResponse)
      throw new Error(`Validation failed: ${validateResponse.status}`);
    }
   
    // Create data transaction record (pending)
    const tvSub = new Tv({ // Updated to Data
      userId: user._id,
      coded,
      provider: coded.split('_')[0], // Store provider part of coded
      number,
      country: "NG",
      payment: 'wallet',
      promo: "0",
      ref: reference,
     price: parsedAmount,
      status: 'pending',
    });
    await tvSub.save();

    // Deduct amount from wallet
    user.wallet.balance -= parsedAmount;
    await user.save();

    // Call MCD Reseller API for data
    const response = await fetch(`${MCD_API_URL}/tv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coded,
        number,
        payment: 'wallet',
        promo:"0",
        ref: reference,
        country: "NG",
        reseller_price: parsedAmount.toString(),
      }),
    });

    if (!response.ok) {
      // Roll back wallet balance and update transaction status
      user.wallet.balance += parsedAmount;
      tvSub.status = 'failed'; // Updated to data
      await Promise.all([user.save(), tvSub.save()]);
      throw new Error(`MCD API error: ${response.status}`);
    }

    const result = await response.json();

    // Update transaction status and log to user wallet
    tvSub.status = 'success'; // Updated to data
    tvSub.tvDetails = result.data || {}; // Store additional API response data
    await tvSub.save();

    user.wallet.transactions.push({
      type: 'debit',
      amount: parsedAmount,
      provider: 'mcd',
      reference,
      status: 'success',
      details: { coded, number, country, type: 'tv_subscription' },
      timestamp: new Date(),
    });
    await user.save();
console.log(result)
    res.json({ success: true, message: 'TV subscription done successful', reference });
  } catch (error) {
    console.error('Data purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase data' });
  }
};






















// Paylony sends your webhook key as a Bearer token on every webhook request.
const verifyPaylonyWebhook = (req) => {
  const expected = process.env.PAYLONY_WEBHOOK_KEY;
  if (!expected) return false;
  return safeEqual(req.headers.authorization, `Bearer ${expected}`);
};

/**
 * Atomically credit a wallet. A single updateOne does the match, the duplicate
 * check and the update, so concurrent/retried webhooks can never double-credit.
 * Returns true if the wallet was credited, false if duplicate or user not found.
 */
async function creditWallet({ filter, amount, provider, reference, narration, timestamp }) {
  const result = await User.updateOne(
    { ...filter, 'wallet.transactions.reference': { $ne: reference } },
    {
      $inc: { 'wallet.balance': amount, balance: amount },
      $push: {
        'wallet.transactions': {
          type: 'credit',
          amount,
          provider,
          reference,
          status: 'success',
          details: { narration: narration || 'Wallet credit' },
          timestamp: safeDate(timestamp),
        },
      },
    }
  );
  return result.modifiedCount === 1;
}


async function debitWallet({ email, amount, provider, reference, details }) {
  return User.findOneAndUpdate(
    { email, 'wallet.balance': { $gte: amount } },
    {
      $inc: { 'wallet.balance': -amount, balance: -amount },
      $push: {
        'wallet.transactions': {
          type: 'debit',
          amount,
          provider,
          reference,
          status: 'success',
          details,
          timestamp: new Date(),
        },
      },
    },
    { new: true, projection: { 'wallet.balance': 1 } }
  );
}


export const getBalance = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email })
      .select('wallet.balance paylonyVirtualAccountDetails.account_number virtualAccountDetails.account_number')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      balance: user.wallet?.balance || 0,
      currency: 'NGN',
      accountNumber:
        user.paylonyVirtualAccountDetails?.account_number || user.virtualAccountDetails?.account_number || null,
    });
  } catch (error) {
    console.error('getBalance error:', error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

// Kept so existing route imports don't break. The balance is always your own
// ledger (wallet.balance), which the webhooks keep up to date. Point your
// routes at getBalance and update the frontend to read `balance`.
export const fetchAndUpdateWalletBalance = getBalance;
export const checkBalancePaystack = getBalance;


export const fetchPaylonyAccounts = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).lean();
    if (!user?.paylonyVirtualAccountDetails?.account_number) {
      return res.status(400).json({ error: 'No Paylony account linked' });
    }

    const { mandate, ...account } = user.paylonyVirtualAccountDetails;
    const recent = (user.wallet?.transactions || []).slice(-50).reverse();

    res.json({
      success: true,
      account,
      wallet: { balance: user.wallet?.balance || 0, transactions: recent },
    });
  } catch (error) {
    console.error('fetchPaylonyAccounts error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Paylony account' });
  }
};




export const fundWallet = async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);
    if (!amount) return res.status(400).json({ error: 'Valid amount is required' });

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { url, reference } = await initializePayment(
      user.email,
      amount,
      `${process.env.CLIENT_URL}/dashboard`,
      user.paystackCustomerId
    );

    // Pending record only. The balance is credited by the webhook once Paystack confirms.
    await User.updateOne(
      { email: user.email },
      {
        $push: {
          'wallet.transactions': {
            type: 'credit',
            amount,
            provider: 'Paystack',
            reference,
            status: 'pending',
            timestamp: new Date(),
          },
        },
      }
    );

    res.json({ url, reference });
  } catch (error) {
    console.error('fundWallet error:', error.message);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
};




export const PaylonyWebhook = async (req, res) => {
  if (!verifyPaylonyWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { event, status, amount, fee, receiving_account, reference, timestamp, sender_narration } = req.body;

    if (event === 'collection' && status === '00' && reference && receiving_account) {
      const gross = Number(amount);
      const net = round2(gross - Number(fee || 0));

      if (Number.isFinite(gross) && net > 0) {
        const credited = await creditWallet({
          filter: { 'paylonyVirtualAccountDetails.account_number': receiving_account },
          amount: net,
          provider: 'paylony',
          reference,
          narration: sender_narration || 'Inward transfer',
          timestamp,
        });

        if (!credited) {
          // Either a duplicate delivery or an unknown account. We still acknowledge,
          // otherwise Paylony keeps retrying something we can't act on.
          console.warn(`Paylony webhook not applied (duplicate or unknown account): ${reference}`);
        }
      }
    }

    // Paylony's docs say the response should simply be "success" for settlement to trigger.
    res.status(200).send('success');
  } catch (error) {
    console.error('Paylony webhook error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const walletCallback = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'reference is required' });
    }

    const user = await User.findOne(
      { 'wallet.transactions.reference': reference },
      { 'wallet.transactions.$': 1 }
    ).lean();

    const tx = user?.wallet?.transactions?.[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    // Deliberately returns no balance or other user data (this route is public).
    res.json({ success: true, reference, status: tx.status, amount: tx.amount, type: tx.type });
  } catch (error) {
    console.error('walletCallback error:', error.message);
    res.status(500).json({ error: 'Failed to process callback' });
  }
};









// One call for the wallet screen: spendable balance, money locked in savings, bank account, last activity
export const summary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('wallet paylonyVirtualAccountDetails virtualAccountDetails txPin.hash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const agg = await Saving.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);

    const recent = visibleTx(user).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6)
      .map((t) => ({ ...t, kind: kindOf(t) }));

    res.json({
      balance: user.wallet?.balance || 0, // available to spend (savings are NOT in here)
      locked: agg[0]?.total || 0, // sitting in savings plans
      currency: 'NGN',
      account: accountOf(user),
      hasPin: !!user.txPin?.hash,
      recent,
    });
  } catch (e) {
    console.error('wallet summary error:', e.message);
    res.status(500).json({ error: 'Failed to load wallet' });
  }
};

// GET /transactions?page=1&limit=20&kind=all|in|out|bills|transfer|savings
export const transactions = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const kind = String(req.query.kind || 'all');

    const user = await User.findById(req.user._id).select('wallet.transactions').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    let list = visibleTx(user).map((t) => ({ ...t, kind: kindOf(t) }));
    if (kind === 'in') list = list.filter((t) => t.type === 'credit');
    else if (kind === 'out') list = list.filter((t) => t.type === 'debit');
    else if (kind !== 'all') list = list.filter((t) => t.kind === kind);

    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const start = (page - 1) * limit;
    res.json({ transactions: list.slice(start, start + limit), page, total: list.length, hasMore: start + limit < list.length });
  } catch (e) {
    console.error('transactions error:', e.message);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
};

// Look up who owns a meter / smartcard / phone number BEFORE paying (like every fintech app does)
export const validateBill = async (req, res) => {
  try {
    const service = ({ tv: 'tv-subscription' })[req.body?.service] || req.body?.service;
    const provider = String(req.body?.provider || '').trim();
    const number = String(req.body?.number || '').trim();
    if (!['airtime', 'data', 'tv-subscription', 'electricity'].includes(service) || !provider || !number) {
      return res.status(400).json({ error: 'service, provider and number are required' });
    }

    const r = await fetch(`${MCD_API_URL}/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MCD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, provider, number }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json.success === false) {
      return res.status(400).json({ error: json.message || 'We could not verify this number' });
    }
    const d = json.data;
    const name = typeof d === 'string' ? d : d?.name ?? d?.customer_name ?? d?.Customer_Name ?? d?.customerName ?? null;
    res.json({ valid: true, name: name ? String(name).trim() : null, details: typeof d === 'object' ? d : null });
  } catch (e) {
    console.error('validateBill error:', e.message);
    res.status(502).json({ error: 'Verification is unavailable right now' });
  }
};

/* ----------------------------- transaction PIN ----------------------------- */

export const pinStatus = async (req, res) => {
  const u = await User.findById(req.user._id).select('txPin').lean();
  res.json({ hasPin: !!u?.txPin?.hash, locked: !!(u?.txPin?.lockedUntil && u.txPin.lockedUntil > new Date()) });
};

// first time: { pin }.  change: { pin, currentPin }
export const setPin = async (req, res) => {
  try {
    const { pin, currentPin } = req.body || {};
    if (!isValidPin(pin)) return res.status(400).json({ error: 'Your PIN must be exactly 4 digits' });
    if (/^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '3210'].includes(pin)) {
      return res.status(400).json({ error: 'That PIN is too easy to guess. Pick another.' });
    }

    const u = await User.findById(req.user._id).select('txPin');
    if (u?.txPin?.hash) {
      const r = await verifyTxPin(req.user._id, String(currentPin ?? '')); // same 5-tries lock applies
      if (!r.ok) return res.status(r.status).json(r.body);
    }
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'txPin.hash': await hashPin(pin), 'txPin.fails': 0, 'txPin.lockedUntil': null, 'txPin.setAt': new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('setPin error:', e.message);
    res.status(500).json({ error: 'Could not save your PIN' });
  }
};





























