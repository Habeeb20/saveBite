import express from "express";
import { protect } from "../middleware/auth.js";
import { requireTxPin } from "../middleware/txPin.js";
import {
  buyAirtime,
  buyDataPin,
  buyData,
  buyElectricity,
  tvSubscription,
  fundWallet,
  walletCallback,
  fetchAndUpdateWalletBalance,
  fetchPaylonyAccounts,
  PaylonyWebhook,
  checkBalancePaystack,
  summary, transactions, validateBill, pinStatus, setPin 
} from "../controllers/walletController.js";
import { getBanks, transferFunds, verifyAccount } from "../controllers/transferController.js";


const router = express.Router();

// Wallet overview (NEW)
router.get("/summary", protect, summary);
router.get("/transactions", protect, transactions);

// Transaction PIN (NEW)
router.get("/pin/status", protect, pinStatus);
router.post("/pin", protect, setPin);

// Wallet funding & balance (unchanged)
router.post("/fund-wallet", protect, fundWallet);
router.get("/callback", walletCallback); // Paystack redirect, no user token
router.get("/wallet-balance", protect, fetchAndUpdateWalletBalance);
router.get("/fetch-and-update-balance/:reference/:provider", protect, fetchAndUpdateWalletBalance);
router.get("/check-balance", protect, checkBalancePaystack);
router.get("/fetch-paylony-accounts", protect, fetchPaylonyAccounts);
router.post("/webhook/paylony", PaylonyWebhook); // called by Paylony, no user token

// Bills: verify the number first (NEW), then pay. Paying now needs the transaction PIN.
router.post("/validate-bill", protect, validateBill);
router.post("/buy-airtime", protect, requireTxPin, buyAirtime);
router.post("/buy-data-pin", protect, requireTxPin, buyDataPin);
router.post("/buy-data", protect, requireTxPin, buyData);
router.post("/buy-electricity", protect, requireTxPin, buyElectricity);
router.post("/buy-tv-subscription", protect, requireTxPin, tvSubscription);

// Bank transfers (Paylony). Sending money needs the transaction PIN.
router.get("/banks", getBanks);
router.post("/verify-account", protect, verifyAccount);
router.post("/transferfunds", protect, requireTxPin, transferFunds);

export default router;