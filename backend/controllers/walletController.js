

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

const accountOf1 = (user) => {
  const p = user?.paylonyVirtualAccountDetails;
  if (p?.account_number) {
    return {
      number: String(p.account_number),
      name: p.account_name || '',
      bank: p.bank_name || p.provider || '',
      provider: 'paylony',
    };
  }

  const v = user?.virtualAccountDetails;
  if (v?.account_number) {
    return {
      number: String(v.account_number),
      name: v.account_name || '',
      bank: v.bank || '',
      provider: 'paystack',
    };
  }

  return null; // no funding account provisioned for this user yet
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


// Paste over your existing accountOf + summary. Imports (User, Saving, mongoose,
// visibleTx, kindOf) stay exactly as they are in your controller file.

// Shape the add-money screen expects: { number, name, bank }
// Source of truth is the Paylony virtual account; the old Paystack one is a fallback.


// One call for the wallet screen: spendable balance, money locked in savings, bank account, last activity
export const summary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('wallet paylonyVirtualAccountDetails virtualAccountDetails txPin.hash')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const agg = await Saving.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);

    const recent = visibleTx(user)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6)
      .map((t) => ({ ...t, kind: kindOf(t) }));

    res.json({
      balance: user.wallet?.balance || 0, // available to spend (savings are NOT in here)
      locked: agg[0]?.total || 0, // sitting in savings plans
      currency: 'NGN',
      account: accountOf1(user), // { number, name, bank, provider } or null
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



























// import crypto from 'crypto';
// import dotenv from 'dotenv';
// import User from '../models/User.js';
// import Airtime from '../models/wallet/airtimeModel.js';
// import Data from '../models/wallet/dataModel.js';
// import Electricty from '../models/wallet/electrictyModel.js';
// import Tv from '../models/wallet/tvModel.js';
// import Saving from '../models/wallet/savingsModel.js';
// import { findPlan } from '../utils/plans.js';
// import {
//   cleanRef, fetchWithTimeout, parseAmount, refundDebit, reserveFunds, round2, safeJson, settleDebit,
// } from '../utils/walletOps.js';
// dotenv.config();
// import mongoose from 'mongoose';
// /* -------------------------------------------------------------------------- */
// /*  Config                                                                    */
// /* -------------------------------------------------------------------------- */

// const MCD_API_URL = process.env.MCD_API_URL || 'https://reseller.mcd.5starcompany.com.ng/api/v1';
// // read lazily: ES module imports can run before dotenv has loaded
// const mcdToken = () => process.env.MCD_TOKEN || process.env.MCD_API_TOKEN;

// const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'];
// const PHONE = /^0\d{10}$/;
// const LIMITS = {
//   airtime: { min: 50, max: 50000 },
//   electricity: { min: 500, max: 500000 },
// };

// const PAYLONY_API_URL = (process.env.PAYLONY_API_URL || 'https://api.paylony.com/api/v1').replace(/[;\s/]+$/, '');

// // Paylony sends your webhook key as a Bearer token on every webhook request.
// const safeEqual = (a, b) => {
//   const ab = Buffer.from(String(a ?? ''));
//   const bb = Buffer.from(String(b ?? ''));
//   return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
// };

// const safeDate = (value) => {
//   const d = value ? new Date(value) : new Date();
//   return Number.isNaN(d.getTime()) ? new Date() : d;
// };

// /* -------------------------------------------------------------------------- */
// /*  Calling the bill provider (MCD)                                           */
// /* -------------------------------------------------------------------------- */

// async function mcd(path, body) {
//   const res = await fetchWithTimeout(
//     `${MCD_API_URL}${path}`,
//     {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${mcdToken()}`, 'Content-Type': 'application/json' },
//       body: JSON.stringify(body),
//     },
//     30000
//   );
//   return { ok: res.ok, status: res.status, data: await safeJson(res) };
// }

// const pending = (res, reference) =>
//   res.status(202).json({
//     success: true,
//     status: 'pending',
//     message: 'Your payment is being processed. It will show in your activity shortly. Please do not pay again.',
//     reference,
//   });

// // the same payment id arrived again (a retry or double tap): answer with what happened the first time
// function replay(res, record, reference) {
//   if (record.status === 'success') return res.json({ success: true, status: 'success', message: 'This payment was already completed', reference });
//   if (record.status === 'pending') return pending(res, reference);
//   return res.status(409).json({ error: 'That payment did not go through. Please start a new one.' });
// }

// /**
//  * The one safe way to pay any bill. In this order:
//  *   1. same payment id already seen?  -> answer from the record, never pay twice
//  *   2. ask the provider to verify the number   (nothing charged yet)
//  *   3. write a pending record
//  *   4. take the money from the wallet in one atomic step (fails cleanly if the balance is too low)
//  *   5. buy from the provider
//  *        - provider says no (4xx)            -> money goes back automatically, exactly once
//  *        - provider unreachable / 5xx / slow -> stays PENDING (it may have gone through),
//  *                                               no refund, no second charge; check it in your dashboard
//  *        - success                           -> history line becomes "success"
//  */
// async function payBill(req, res, s) {
//   const userId = req.user._id;
//   const clientRef = cleanRef(req.body?.clientRef);
//   const reference = clientRef ? `mcd_${clientRef}` : `mcd_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

//   const previous = await s.Model.findOne({ ref: reference, userId });
//   if (previous) return replay(res, previous, reference);

//   if (s.validate) {
//     let v;
//     try {
//       v = await mcd('/validate', s.validate);
//     } catch {
//       return res.status(503).json({ error: 'The provider is not reachable right now. You have not been charged.' });
//     }
//     if (!v.ok || v.data?.success === false) {
//       return res.status(400).json({ error: v.data?.message || 'We could not verify this number' });
//     }
//   }

//   let record;
//   try {
//     record = await s.Model.create({ userId, ...s.record(reference), status: 'pending' });
//   } catch (e) {
//     if (e.code === 11000) {
//       const again = await s.Model.findOne({ ref: reference, userId });
//       if (again) return replay(res, again, reference);
//     }
//     throw e;
//   }
//   const mark = (status) => { record.status = status; return record.save().catch((e) => console.error('record save failed:', reference, e.message)); };

//   let funded;
//   try {
//     funded = await reserveFunds({
//       userId, amount: s.amount, provider: 'mcd', reference,
//       details: { service: s.service, number: s.number, provider: s.provider, ...s.details },
//     });
//   } catch (e) {
//     await mark('failed');
//     throw e;
//   }
//   if (!funded) {
//     await mark('failed');
//     return res.status(400).json({ error: 'Insufficient wallet balance' });
//   }

//   let r;
//   try {
//     r = await mcd(s.path, s.body(reference));
//   } catch (e) {
//     console.error(`${s.service}: outcome unknown (no answer):`, reference, e.message);
//     return pending(res, reference);
//   }

//   if (r.status >= 500) {
//     console.error(`${s.service}: outcome unknown (provider ${r.status}):`, reference, r.data);
//     return pending(res, reference);
//   }

//   if (!r.ok || r.data?.success === false) {
//     const gaveBack = await refundDebit(userId, s.amount, reference);
//     await mark('failed');
//     console.error(`${s.service} declined:`, reference, r.status, r.data, gaveBack ? '(refunded)' : '(refund NOT applied)');
//     return res.status(400).json({ error: r.data?.message || `The provider could not complete this ${s.label} (${r.status})` });
//   }

//   await settleDebit(userId, reference, 'success');
//   if (s.onSuccess) s.onSuccess(record, r.data);
//   await mark('success');
//   return res.json({ success: true, status: 'success', message: s.successMessage, reference, ...(s.extra ? s.extra(r.data) : {}) });
// }

// const fail = (res, label, e) => {
//   console.error(`${label} error:`, e);
//   return res.status(500).json({ error: 'Something went wrong. If money left your wallet it will be returned or shown as pending.' });
// };

// /* -------------------------------------------------------------------------- */
// /*  Bills                                                                     */
// /* -------------------------------------------------------------------------- */

// export const fetchWalletBalance = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.user.email });
//     if (!user) return res.status(404).json({ error: 'User not found' });
//     res.json({ balance: user.wallet.balance });
//   } catch (error) {
//     console.error('Fetch wallet balance error:', error);
//     res.status(500).json({ error: 'Failed to fetch wallet balance' });
//   }
// };

// // body: { network, phone, amount, clientRef }
// export const buyAirtime = async (req, res) => {
//   try {
//     const provider = String(req.body.network ?? req.body.provider ?? '').toLowerCase();
//     const number = String(req.body.phone ?? req.body.number ?? '').trim();
//     const amount = parseAmount(req.body.amount);
//     const promo = String(req.body.promo ?? '0');

//     if (!NETWORKS.includes(provider)) return res.status(400).json({ error: 'Choose a network' });
//     if (!PHONE.test(number)) return res.status(400).json({ error: 'Enter a valid 11-digit phone number' });
//     if (!amount || amount < LIMITS.airtime.min || amount > LIMITS.airtime.max) {
//       return res.status(400).json({ error: `Airtime must be between ₦${LIMITS.airtime.min} and ₦${LIMITS.airtime.max.toLocaleString()}` });
//     }

//     return await payBill(req, res, {
//       Model: Airtime, service: 'airtime', label: 'airtime purchase', provider, number, amount,
//       validate: { service: 'airtime', provider, number },
//       record: (ref) => ({ provider, amount, number, country: 'NGN', payment: 'wallet', promo, ref, operatorID: 0, type: 'airtime' }),
//       details: { type: 'airtime', country: 'NG' },
//       path: '/airtime',
//       body: (ref) => ({ provider, amount: amount.toString(), number, country: 'NG', payment: 'wallet', promo, ref, operatorID: 0 }),
//       successMessage: 'Airtime purchase successful',
//     });
//   } catch (e) { return fail(res, 'Airtime', e); }
// };

// // legacy "data pin" (pay an amount, not a plan). body: { provider, number, amount, clientRef }
// export const buyDataPin = async (req, res) => {
//   try {
//     const provider = String(req.body.provider ?? req.body.network ?? '').toLowerCase();
//     const number = String(req.body.number ?? req.body.phone ?? '').trim();
//     const amount = parseAmount(req.body.amount);
//     const country = 'NG';
//     const promo = String(req.body.promo ?? '0');

//     if (!NETWORKS.includes(provider)) return res.status(400).json({ error: 'Choose a network' });
//     if (!PHONE.test(number)) return res.status(400).json({ error: 'Enter a valid 11-digit phone number' });
//     if (!amount || amount < LIMITS.airtime.min || amount > LIMITS.airtime.max) {
//       return res.status(400).json({ error: 'Enter a valid amount' });
//     }

//     return await payBill(req, res, {
//       Model: Airtime, service: 'data', label: 'data pin purchase', provider, number, amount,
//       validate: { service: 'data', provider, number },
//       record: (ref) => ({ provider, amount, number, country, payment: 'wallet', promo, ref, operatorID: 0, type: 'data_pin' }),
//       details: { type: 'data_pin', country },
//       path: '/data',
//       body: (ref) => ({ provider, amount: amount.toString(), number, country, payment: 'wallet', promo, ref, operatorID: 0 }),
//       successMessage: 'Data pin purchase successful',
//     });
//   } catch (e) { return fail(res, 'Data pin', e); }
// };

// // body: { coded, number, clientRef }.  The PRICE comes from your plan files, never from the phone.
// export const buyData = async (req, res) => {
//   try {
//     const coded = String(req.body.coded ?? '').trim();
//     const number = String(req.body.number ?? '').trim();
//     if (!coded || !number) return res.status(400).json({ error: 'Missing required fields' });
//     if (!PHONE.test(number)) return res.status(400).json({ error: 'Enter a valid 11-digit phone number' });

//     const plan = findPlan(coded);
//     if (!plan) return res.status(400).json({ error: 'This data plan is no longer available' });
//     const amount = parseAmount(plan.reseller_price ?? plan.price);
//     if (!amount) return res.status(400).json({ error: 'This data plan has no valid price' });

//     const provider = coded.split('_')[0].toLowerCase();
//     return await payBill(req, res, {
//       Model: Data, service: 'data', label: 'data purchase', provider, number, amount,
//       validate: { service: 'data', provider, number },
//       record: (ref) => ({ coded, provider: coded.split('_')[0], number, country: 'NG', payment: 'wallet', promo: '0', ref, reseller_price: amount }),
//       details: { type: 'data', coded, plan: plan.name, country: 'NG' },
//       path: '/data',
//       body: (ref) => ({ coded, number, payment: 'wallet', promo: '0', ref, country: 'NG', reseller_price: amount.toString() }),
//       onSuccess: (record, data) => { record.dataPlanDetails = data?.data || {}; },
//       successMessage: 'Data purchase successful',
//     });
//   } catch (e) { return fail(res, 'Data', e); }
// };

// // body: { number, amount, provider?, meterType?, clientRef }
// export const buyElectricity = async (req, res) => {
//   try {
//     const number = String(req.body.number ?? '').trim();
//     const amount = parseAmount(req.body.amount);
//     const provider = String(req.body.provider || 'ikeja-electric').toLowerCase();
//     const meterType = req.body.meterType === 'postpaid' ? 'postpaid' : 'prepaid';

//     if (!/^[a-z0-9-]{3,40}$/.test(provider)) return res.status(400).json({ error: 'Choose an electricity company' });
//     if (!/^\d{10,13}$/.test(number)) return res.status(400).json({ error: 'Enter a valid meter number' });
//     if (!amount || amount < LIMITS.electricity.min || amount > LIMITS.electricity.max) {
//       return res.status(400).json({ error: `You can pay between ₦${LIMITS.electricity.min} and ₦${LIMITS.electricity.max.toLocaleString()}` });
//     }

//     return await payBill(req, res, {
//       Model: Electricty, service: 'electricity', label: 'electricity payment', provider, number, amount,
//       validate: { service: 'electricity', provider, number },
//       record: (ref) => ({ number, provider, amount, ref, promo: '0', payment: 'wallet', country: 'NG' }),
//       details: { type: 'electricity', meterType, country: 'NG' },
//       path: '/electricity',
//       // if your provider needs the meter type, add it here:  meterType,
//       body: (ref) => ({ number, provider, amount, ref, promo: '0', payment: 'wallet', country: 'NG' }),
//       onSuccess: (record, data) => { record.electricityDetails = data?.data || {}; },
//       extra: (data) => {
//         const token = data?.data?.token ?? data?.data?.Token ?? data?.token ?? null;
//         return token ? { token } : {};
//       },
//       successMessage: 'Electricity payment successful',
//     });
//   } catch (e) { return fail(res, 'Electricity', e); }
// };

// // body: { coded, number, clientRef }.  The PRICE comes from your plan files.
// export const tvSubscription = async (req, res) => {
//   try {
//     const coded = String(req.body.coded ?? '').trim();
//     const number = String(req.body.number ?? '').trim();
//     if (!coded || !number) return res.status(400).json({ error: 'Missing required fields' });
//     if (!/^\d{8,13}$/.test(number)) return res.status(400).json({ error: 'Enter a valid smartcard / IUC number' });

//     const plan = findPlan(coded);
//     if (!plan) return res.status(400).json({ error: 'This TV package is no longer available' });
//     const amount = parseAmount(plan.price ?? plan.reseller_price);
//     if (!amount) return res.status(400).json({ error: 'This TV package has no valid price' });

//     const provider = coded.split('_')[0];
//     return await payBill(req, res, {
//       Model: Tv, service: 'tv', label: 'TV subscription', provider, number, amount,
//       validate: { service: 'tv-subscription', provider, number },
//       record: (ref) => ({ coded, provider, number, country: 'NG', payment: 'wallet', promo: '0', ref, price: amount }),
//       details: { type: 'tv_subscription', coded, plan: plan.name, country: 'NG' },
//       path: '/tv',
//       body: (ref) => ({ coded, number, payment: 'wallet', promo: '0', ref, country: 'NG', reseller_price: amount.toString() }),
//       onSuccess: (record, data) => { record.tvDetails = data?.data || {}; },
//       successMessage: 'TV subscription successful',
//     });
//   } catch (e) { return fail(res, 'TV', e); }
// };

// /* -------------------------------------------------------------------------- */
// /*  Balance & account                                                         */
// /* -------------------------------------------------------------------------- */

// export const getBalance = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.user.email })
//       .select('wallet.balance paylonyVirtualAccountDetails.account_number virtualAccountDetails.account_number')
//       .lean();
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     res.json({
//       success: true,
//       balance: user.wallet?.balance || 0,
//       currency: 'NGN',
//       accountNumber: user.paylonyVirtualAccountDetails?.account_number || user.virtualAccountDetails?.account_number || null,
//     });
//   } catch (error) {
//     console.error('getBalance error:', error.message);
//     res.status(500).json({ error: 'Failed to fetch balance' });
//   }
// };

// // Kept so existing route imports don't break. The balance is always your own ledger (wallet.balance).
// export const fetchAndUpdateWalletBalance = getBalance;
// export const checkBalancePaystack = getBalance;

// export const fetchPaylonyAccounts = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.user.email }).lean();
//     if (!user?.paylonyVirtualAccountDetails?.account_number) {
//       return res.status(400).json({ error: 'No Paylony account linked' });
//     }
//     const { mandate, ...account } = user.paylonyVirtualAccountDetails;
//     const recent = (user.wallet?.transactions || []).slice(-50).reverse();
//     res.json({ success: true, account, wallet: { balance: user.wallet?.balance || 0, transactions: recent } });
//   } catch (error) {
//     console.error('fetchPaylonyAccounts error:', error.message);
//     res.status(500).json({ error: 'Failed to fetch Paylony account' });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*  Funding                                                                   */
// /* -------------------------------------------------------------------------- */

// // Card funding (Paystack). Your old file called initializePayment() without importing it, which crashed.
// // It is loaded only when needed now; if you add a utils/paystack.js exporting it, this works again.
// export const fundWallet = async (req, res) => {
//   try {
//     const amount = parseAmount(req.body.amount);
//     if (!amount) return res.status(400).json({ error: 'Valid amount is required' });

//     let initializePayment;
//     try {
//       ({ initializePayment } = await import('../utils/paystack.js'));
//     } catch {
//       return res.status(501).json({ error: 'Card funding is not switched on. Please add money by bank transfer.' });
//     }

//     const user = await User.findOne({ email: req.user.email });
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const { url, reference } = await initializePayment(user.email, amount, `${process.env.CLIENT_URL}/dashboard`, user.paystackCustomerId);

//     // Pending record only. The balance is credited by the webhook once the payment is confirmed.
//     await User.updateOne(
//       { email: user.email },
//       { $push: { 'wallet.transactions': { type: 'credit', amount, provider: 'Paystack', reference, status: 'pending', timestamp: new Date() } } }
//     );
//     res.json({ url, reference });
//   } catch (error) {
//     console.error('fundWallet error:', error.message);
//     res.status(500).json({ error: 'Failed to initialize payment' });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*  Paylony webhook (money arriving by bank transfer)                         */
// /* -------------------------------------------------------------------------- */

// const verifyPaylonyWebhook = (req) => {
//   const expected = process.env.PAYLONY_WEBHOOK_KEY;
//   if (!expected) return false;
//   return safeEqual(req.headers.authorization, `Bearer ${expected}`);
// };

// /**
//  * Atomically credit a wallet. One updateOne does the match, the duplicate check and the update,
//  * so concurrent or retried webhooks can never double-credit.
//  */
// async function creditWallet({ filter, amount, provider, reference, narration, timestamp }) {
//   const result = await User.updateOne(
//     { ...filter, 'wallet.transactions.reference': { $ne: reference } },
//     {
//       $inc: { 'wallet.balance': amount, balance: amount },
//       $push: {
//         'wallet.transactions': {
//           type: 'credit', amount, provider, reference, status: 'success',
//           details: { narration: narration || 'Wallet credit' }, timestamp: safeDate(timestamp),
//         },
//       },
//     }
//   );
//   return result.modifiedCount === 1;
// }

// export const PaylonyWebhook = async (req, res) => {
//   if (!verifyPaylonyWebhook(req)) return res.status(401).json({ error: 'Unauthorized' });

//   try {
//     const { event, status, amount, fee, receiving_account, reference, timestamp, sender_narration } = req.body;

//     if (event === 'collection' && status === '00' && reference && receiving_account) {
//       const gross = Number(amount);
//       const net = round2(gross - Number(fee || 0));

//       if (Number.isFinite(gross) && net > 0) {
//         const credited = await creditWallet({
//           filter: { 'paylonyVirtualAccountDetails.account_number': receiving_account },
//           amount: net, provider: 'paylony', reference,
//           narration: sender_narration || 'Inward transfer', timestamp,
//         });
//         if (!credited) {
//           // duplicate delivery or unknown account: still acknowledge, or Paylony keeps retrying
//           console.warn(`Paylony webhook not applied (duplicate or unknown account): ${reference}`);
//         }
//       }
//     }
//     res.status(200).send('success'); // Paylony wants a plain "success" to settle
//   } catch (error) {
//     console.error('Paylony webhook error:', error.message);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

// export const walletCallback = async (req, res) => {
//   try {
//     const { reference } = req.query;
//     if (!reference || typeof reference !== 'string') return res.status(400).json({ error: 'reference is required' });

//     const user = await User.findOne({ 'wallet.transactions.reference': reference }, { 'wallet.transactions.$': 1 }).lean();
//     const tx = user?.wallet?.transactions?.[0];
//     if (!tx) return res.status(404).json({ error: 'Transaction not found' });

//     // deliberately returns no balance or other user data (this route is public)
//     res.json({ success: true, reference, status: tx.status, amount: tx.amount, type: tx.type });
//   } catch (error) {
//     console.error('walletCallback error:', error.message);
//     res.status(500).json({ error: 'Failed to process callback' });
//   }
// };




// /* ----------------------------- transaction PIN ----------------------------- */

// export const pinStatus = async (req, res) => {
//   const u = await User.findById(req.user._id).select('txPin').lean();
//   res.json({ hasPin: !!u?.txPin?.hash, locked: !!(u?.txPin?.lockedUntil && u.txPin.lockedUntil > new Date()) });
// };

// // first time: { pin }.  change: { pin, currentPin }
// export const setPin = async (req, res) => {
//   try {
//     const { pin, currentPin } = req.body || {};
//     if (!isValidPin(pin)) return res.status(400).json({ error: 'Your PIN must be exactly 4 digits' });
//     if (/^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '3210'].includes(pin)) {
//       return res.status(400).json({ error: 'That PIN is too easy to guess. Pick another.' });
//     }

//     const u = await User.findById(req.user._id).select('txPin');
//     if (u?.txPin?.hash) {
//       const r = await verifyTxPin(req.user._id, String(currentPin ?? '')); // same 5-tries lock applies
//       if (!r.ok) return res.status(r.status).json(r.body);
//     }
//     await User.updateOne(
//       { _id: req.user._id },
//       { $set: { 'txPin.hash': await hashPin(pin), 'txPin.fails': 0, 'txPin.lockedUntil': null, 'txPin.setAt': new Date() } }
//     );
//     res.json({ ok: true });
//   } catch (e) {
//     console.error('setPin error:', e.message);
//     res.status(500).json({ error: 'Could not save your PIN' });
//   }
// };






// export const summary = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id)
//       .select('wallet paylonyVirtualAccountDetails virtualAccountDetails txPin.hash').lean();
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const agg = await Saving.aggregate([
//       { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), status: 'active' } },
//       { $group: { _id: null, total: { $sum: '$balance' } } },
//     ]);

//     const recent = visibleTx(user).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6)
//       .map((t) => ({ ...t, kind: kindOf(t) }));

//     res.json({
//       balance: user.wallet?.balance || 0, // available to spend (savings are NOT in here)
//       locked: agg[0]?.total || 0, // sitting in savings plans
//       currency: 'NGN',
//       account: accountOf(user),
//       hasPin: !!user.txPin?.hash,
//       recent,
//     });
//   } catch (e) {
//     console.error('wallet summary error:', e.message);
//     res.status(500).json({ error: 'Failed to load wallet' });
//   }
// };






// // GET /transactions?page=1&limit=20&kind=all|in|out|bills|transfer|savings
// export const transactions = async (req, res) => {
//   try {
//     const page = Math.max(1, Number(req.query.page) || 1);
//     const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
//     const kind = String(req.query.kind || 'all');

//     const user = await User.findById(req.user._id).select('wallet.transactions').lean();
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     let list = visibleTx(user).map((t) => ({ ...t, kind: kindOf(t) }));
//     if (kind === 'in') list = list.filter((t) => t.type === 'credit');
//     else if (kind === 'out') list = list.filter((t) => t.type === 'debit');
//     else if (kind !== 'all') list = list.filter((t) => t.kind === kind);

//     list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
//     const start = (page - 1) * limit;
//     res.json({ transactions: list.slice(start, start + limit), page, total: list.length, hasMore: start + limit < list.length });
//   } catch (e) {
//     console.error('transactions error:', e.message);
//     res.status(500).json({ error: 'Failed to load transactions' });
//   }
// };



// export const validateBill = async (req, res) => {
//   try {
//     const service = ({ tv: 'tv-subscription' })[req.body?.service] || req.body?.service;
//     const provider = String(req.body?.provider || '').trim();
//     const number = String(req.body?.number || '').trim();
//     if (!['airtime', 'data', 'tv-subscription', 'electricity'].includes(service) || !provider || !number) {
//       return res.status(400).json({ error: 'service, provider and number are required' });
//     }

//     const r = await fetch(`${MCD_API_URL}/validate`, {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${process.env.MCD_TOKEN}`, 'Content-Type': 'application/json' },
//       body: JSON.stringify({ service, provider, number }),
//     });
//     const json = await r.json().catch(() => ({}));
//     if (!r.ok || json.success === false) {
//       return res.status(400).json({ error: json.message || 'We could not verify this number' });
//     }
//     const d = json.data;
//     const name = typeof d === 'string' ? d : d?.name ?? d?.customer_name ?? d?.Customer_Name ?? d?.customerName ?? null;
//     res.json({ valid: true, name: name ? String(name).trim() : null, details: typeof d === 'object' ? d : null });
//   } catch (e) {
//     console.error('validateBill error:', e.message);
//     res.status(502).json({ error: 'Verification is unavailable right now' });
//   }
// };
