import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  startSignup,
  verifySignupCode,
  completeSignup,
  login,
  refresh,
  logout,
  getMe,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { biometricLogin, disableBiometric, enableBiometric } from "../controllers/biometricsController.js";

import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/userController.js';


const router = Router();

const limiter = (windowMin, max, message) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// Sending emails is the expensive/abusable part, so it has the strictest limit.
const codeLimiter = limiter(10, 6, "Too many code requests. Please try again in a few minutes.");
const authLimiter = limiter(15, 30, "Too many attempts. Please try again later.");

/* ---------- signup (3 calls: start -> verify -> complete) ---------- */
router.post("/signup/start", codeLimiter, startSignup);
router.post("/signup/resend", codeLimiter, startSignup);
router.post("/signup/verify", authLimiter, verifySignupCode);
router.post("/signup/complete", authLimiter, completeSignup);

/* ---------- session ---------- */
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);



router.post("/biometric/enable", protect, enableBiometric);
router.post("/biometric/disable", protect, disableBiometric);
router.post("/biometric/login", authLimiter, biometricLogin); // use the same rate limiter as password login


router.use(protect);

router.patch('/me', h(c.updateMe));
router.get('/me/addresses', h(c.listAddresses));
router.post('/me/addresses', h(c.addAddress));
router.patch('/me/addresses/:addrId', h(c.updateAddress));
router.delete('/me/addresses/:addrId', h(c.deleteAddress));
router.get('/:id/public', h(c.publicProfile)); // keep LAST



export default router;
