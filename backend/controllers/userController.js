import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PendingSignup from "../models/PendingSignup.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendVerificationEmail } from "../utils/sendEmail.js";
import { normalizePhone, isNigerianPhone } from "../utils/phone.js";
import {
  REFRESH_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signSignupToken,
  verifySignupToken,
} from "../utils/tokens.js";
import dotenv from "dotenv";
import axios from "axios";
import { generateUsername } from "../config/generateUsername.js";

import { AUTHOR_FIELDS, authorView } from '../utils/serializers.js';
import { fail } from '../utils/asyncHandler.js';
import { withTimeout } from "../utils/withTimeout.js";
dotenv.config();




/* ----------------------------- settings ----------------------------- */

const CODE_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
const RESEND_COOLDOWN_S = 60; // seconds before a new code can be requested
const MAX_CODE_ATTEMPTS = 5;
const PENDING_TTL_MS = 60 * 60 * 1000; // an unfinished signup is deleted after 1 hour

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L}' -]{1,39}$/u;
const GENDERS = ["male", "female", "other", "prefer_not_to_say"];
const SIGNUP_ROLES = ["buyer", "seller", "rider"]; // admin is never self-assigned
const SELLER_TYPES = ["foodstuff", "cooked"];
const VEHICLES = ["bicycle", "motorbike", "tricycle", "car", "van"];

const INVALID_LOGIN = "Incorrect email/phone or password";
// Used so a wrong email takes as long to answer as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("savebite-dummy-password", 12);

/* ----------------------------- helpers ----------------------------- */

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

// 4-digit code, stored as an HMAC so a leaked database doesn't reveal valid codes.
const generateCode = () => String(crypto.randomInt(0, 10000)).padStart(4, "0");
const hashCode = (code) =>
  crypto
    .createHmac("sha256", process.env.OTP_SECRET || process.env.JWT_ACCESS_SECRET || "dev-secret")
    .update(String(code))
    .digest("hex");
const safeEqual = (a, b) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

export const issueTokens = async (user, req) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.addSession({
    token: refreshToken,
    device: String(req.headers["user-agent"] || "").slice(0, 120),
    ip: req.ip,
    ttlMs: REFRESH_TTL_MS,
  });
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const signupExpired = () =>
  new ApiError(401, "Your verification expired. Please start again.", { code: "SIGNUP_EXPIRED" });



















async function createPaylonyVirtualAccount(user, dob) {
  try {
    const { data } = await axios.post(
      "https://api.paylony.com/api/v1/create_account",
      {
        customer_id: user._id.toString(),
        firstname: user.firstName,
        lastname: user.lastName,
        address: user.address,
        gender: user.gender,
        email: user.email,
        phone: user.phone,
        dob,
        currency: "NGN",
        provider: "netbank",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYLONY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
    
      }
    );

    const accountData = data?.data;
    console.log("Paylony account creation response:", data);
    console.log("Paylony account details:", accountData);
    if (!accountData?.account_number || !accountData?.account_name) {
      throw new Error("Invalid response from Paylony API for account creation");
    }

    user.paylonyVirtualAccountDetails = {
      account_number: accountData.account_number,
      account_name: accountData.account_name,
      bank_name: "NET microfinance bank",
    };
    await user.save();
    return user.paylonyVirtualAccountDetails;
  } catch (error) {
    // Signup must not fail just because the virtual account failed.
    console.error(
      "Paylony virtual account creation error:",
      error.response?.data || error.message
    );
    return null;
  }
}
/* =========================================================================
   SIGNUP STEP 1: email -> 4-digit code
   POST /api/auth/signup/start   { email }
   POST /api/auth/signup/resend  { email }   (same handler)
   ========================================================================= */
export const startSignup = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) throw new ApiError(400, "Enter a valid email address");

  const exists = await User.exists({ email }).setOptions({ withDeleted: true });
  if (exists) {
    throw new ApiError(409, "An account with this email already exists. Try logging in.", {
      code: "EMAIL_EXISTS",
    });
  }

  const pending = await PendingSignup.findOne({ email });
  if (pending?.lastSentAt) {
    const waitS = Math.ceil(RESEND_COOLDOWN_S - (Date.now() - pending.lastSentAt.getTime()) / 1000);
    if (waitS > 0) {
      throw new ApiError(429, `Please wait ${waitS}s before asking for another code`, {
        code: "RESEND_COOLDOWN",
        retryAfter: waitS,
      });
    }
  }

  const code = generateCode();
  const now = Date.now();
  await PendingSignup.findOneAndUpdate(
    { email },
    {
      email,
      codeHash: hashCode(code),
      codeExpiresAt: new Date(now + CODE_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(now),
      verified: false,
      verifiedAt: null,
      expireAt: new Date(now + PENDING_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Email send failed:", err.message);
    await PendingSignup.updateOne({ email }, { $unset: { lastSentAt: 1 } }); // let them retry now
    throw new ApiError(502, "We couldn't send the email. Please try again in a moment.", {
      code: "EMAIL_FAILED",
    });
  }

  res.json({
    success: true,
    message: `We sent a 4-digit code to ${email}`,
    resendAfter: RESEND_COOLDOWN_S,
  });
});

/* =========================================================================
   SIGNUP STEP 2: check the code
   POST /api/auth/signup/verify  { email, code }  ->  { signupToken }
   ========================================================================= */
export const verifySignupCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || "").trim();
  if (!EMAIL_RE.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (!/^\d{4}$/.test(code)) throw new ApiError(400, "Enter the 4-digit code");

  const pending = await PendingSignup.findOne({ email });
  if (!pending) {
    throw new ApiError(400, "No code was requested for this email. Please start again.", {
      code: "NO_PENDING",
    });
  }
  if (pending.codeExpiresAt < new Date()) {
    throw new ApiError(400, "This code has expired. Request a new one.", { code: "CODE_EXPIRED" });
  }
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    throw new ApiError(429, "Too many wrong attempts. Request a new code.", {
      code: "TOO_MANY_ATTEMPTS",
    });
  }

  if (!safeEqual(hashCode(code), pending.codeHash)) {
    pending.attempts += 1;
    await pending.save();
    const left = MAX_CODE_ATTEMPTS - pending.attempts;
    throw new ApiError(
      400,
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many wrong attempts. Request a new code.",
      { code: "CODE_INVALID" }
    );
  }

  pending.verified = true;
  pending.verifiedAt = new Date();
  pending.codeHash = hashCode(crypto.randomUUID()); // the code can't be used again
  await pending.save();

  res.json({ success: true, signupToken: signSignupToken(email) });
});

/* =========================================================================
   SIGNUP STEP 3: create the account (details + role + password)
   POST /api/auth/signup/complete
   { signupToken, firstName, lastName, gender, phone, password,
     role: "buyer" | "seller" | "rider",
     businessName, sellerType   (sellers)
     vehicleType                (riders) }
   ========================================================================= */
// Replace your completeSignup in authController.js with this one, and add this import at the top:
//   import { withTimeout } from "../utils/withTimeout.js";

/* =========================================================================
   SIGNUP STEP 3: create the account (details + role + password)
   POST /api/auth/signup/complete
   ========================================================================= */
export const completeSignup = asyncHandler(async (req, res) => {
  const {
    signupToken: token,
    firstName,
    lastName,
    gender,
    phone,
    dob,
    address,
    password,
    role = "buyer",
    businessName,
    sellerType,
    vehicleType,
  } = req.body;

  let payload;
  try {
    payload = verifySignupToken(token);
  } catch {
    throw signupExpired();
  }
  if (payload.purpose !== "signup" || !payload.email) throw signupExpired();

  const pending = await PendingSignup.findOne({ email: payload.email, verified: true });
  if (!pending) throw signupExpired();

  // ----- validate everything and report all problems at once -----
  const errors = {};
  if (!NAME_RE.test(String(firstName || "").trim())) errors.firstName = "Enter your first name";
  if (!NAME_RE.test(String(lastName || "").trim())) errors.lastName = "Enter your last name";
  if (!GENDERS.includes(gender)) errors.gender = "Select your gender";
  if (!isNigerianPhone(phone)) errors.phone = "Enter a valid Nigerian phone number";
  if (!SIGNUP_ROLES.includes(role)) errors.role = "Choose how you will use SaveBite";

  // dob is optional here; add `if (!dob) errors.dob = "Enter your date of birth"` if Paylony needs it
  const dobDate = dob ? new Date(dob) : undefined;
  if (dob && (Number.isNaN(dobDate.getTime()) || dobDate > new Date())) {
    errors.dob = "Enter a valid date of birth";
  }

  const pw = String(password || "");
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    errors.password = "Use at least 8 characters with a letter and a number";
  }

  if (role === "seller") {
    if (String(businessName || "").trim().length < 2) errors.businessName = "Enter your business name";
    if (!SELLER_TYPES.includes(sellerType)) errors.sellerType = "Choose what you sell";
  }
  if (role === "rider" && !VEHICLES.includes(vehicleType)) {
    errors.vehicleType = "Choose your vehicle type";
  }

  const normalizedPhone = normalizePhone(phone);
  if (!errors.phone) {
    const taken = await User.exists({ phone: normalizedPhone }).setOptions({ withDeleted: true });
    if (taken) errors.phone = "This phone number is already registered";
  }

  if (Object.keys(errors).length) {
    throw new ApiError(422, Object.values(errors)[0], { errors });
  }

  // ----- create the user -----
  const roles = role === "seller" ? ["buyer", "seller"] : role === "rider" ? ["rider"] : ["buyer"];

  const user = new User({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    gender,
    username: await generateUsername(firstName, lastName),
    phone: normalizedPhone,
    dob: dobDate,
    address: address?.trim() || undefined,
    email: payload.email,
    password: pw,
    roles,
    activeRole: role,
    security: { emailVerified: true },
    ...(role === "seller" && {
      seller: { businessName: businessName.trim(), sellerType },
    }),
    ...(role === "rider" && { rider: { vehicleType } }),
  });

  let saved = false;
  try {
    await user.save(); // duplicate email/phone are turned into a 409 by the error handler
    saved = true;

    // Paylony must never break or slow down signup: wait at most a few seconds, ignore failures.
    const virtualAccount = await withTimeout(
      createPaylonyVirtualAccount(user, dob),
      Number(process.env.PAYLONY_TIMEOUT_MS || 8000),
      "Paylony virtual account"
    ).catch((err) => {
      console.error("[signup] Paylony virtual account failed:", err?.message || err);
      return null; // the account still gets created; retry the virtual account later
    });

    await user.registerSuccessfulLogin();
    const tokens = await issueTokens(user, req);

    // Only now is the signup really finished, so only now is the pending record deleted.
    await PendingSignup.deleteOne({ email: payload.email });

    return res.status(201).json({ success: true, user, virtualAccount, ...tokens });
  } catch (err) {
    // Something broke after the user was saved: undo it, so trying again works
    // (no "user already exists") and the same signupToken is still valid.
    if (saved) {
      await User.deleteOne({ _id: user._id }).catch((e) =>
        console.error("[signup] rollback failed:", e?.message || e)
      );
    }
    throw err;
  }
});

  


/* =========================================================================
   LOGIN
   POST /api/auth/login  { identifier: email or phone, password }
   ========================================================================= */
export const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");
  if (!identifier || !password) {
    throw new ApiError(400, "Enter your email or phone number and your password");
  }

  const query = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) };

  const user = await User.findOne(query).select("+password +security.sessions");

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); // keep timing similar
    throw new ApiError(401, INVALID_LOGIN, { code: "INVALID_CREDENTIALS" });
  }

  if (user.isLocked) {
    const mins = Math.ceil((user.security.lockUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(
      423,
      `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
      { code: "ACCOUNT_LOCKED" }
    );
  }

  if (!(await user.comparePassword(password))) {
    await user.registerFailedLogin();
    throw new ApiError(401, INVALID_LOGIN, { code: "INVALID_CREDENTIALS" });
  }

  if (user.blocked?.isBlocked) {
    throw new ApiError(403, "Your account has been blocked. Please contact support.", {
      code: "ACCOUNT_BLOCKED",
    });
  }
  if (!user.isActive) {
    throw new ApiError(403, "Your account is deactivated.", { code: "ACCOUNT_INACTIVE" });
  }

  await user.registerSuccessfulLogin();
  const tokens = await issueTokens(user, req);

  res.json({ success: true, user, ...tokens });
});

/* =========================================================================
   REFRESH   POST /api/auth/refresh  { refreshToken }  ->  new token pair
   ========================================================================= */
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const expired = () =>
    new ApiError(401, "Your session has expired. Please log in again.", { code: "SESSION_EXPIRED" });

  if (!refreshToken) throw new ApiError(400, "refreshToken is required");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw expired();
  }

  const user = await User.findById(payload.sub).select("+security.sessions");
  if (!user || !user.hasSession(refreshToken)) throw expired();

  if (user.blocked?.isBlocked) {
    throw new ApiError(403, "Your account has been blocked. Please contact support.", {
      code: "ACCOUNT_BLOCKED",
    });
  }
  if (!user.isActive) {
    throw new ApiError(403, "Your account is deactivated.", { code: "ACCOUNT_INACTIVE" });
  }

  user.removeSession(refreshToken); // rotate: the old token stops working
  const tokens = await issueTokens(user, req);

  res.json({ success: true, ...tokens });
});

/* =========================================================================
   LOGOUT   POST /api/auth/logout  { refreshToken?, all? }   (needs access token)
   ========================================================================= */
export const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+security.sessions");
  if (req.body.all) user.security.sessions = [];
  else if (req.body.refreshToken) user.removeSession(req.body.refreshToken);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true });
});

/* =========================================================================
   ME   GET /api/auth/me   (needs access token)
   ========================================================================= */
export const getMe = asyncHandler(async (req, res) => {
 
  res.json({ success: true, user: req.user });
});










const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export const publicProfile = async (req, res) => {
  const u = await User.findById(req.params.id).select(`${AUTHOR_FIELDS} seller.followersCount seller.postsCount`).lean();
  if (!u) return fail(res, 404, 'User not found');
  res.json({ user: { ...authorView(u), followers: u.seller?.followersCount ?? 0, posts: u.seller?.postsCount ?? 0 } });
};

// phone/email are NOT editable here: changing them should go through OTP verification
export const updateMe = async (req, res) => {
  const { firstName, lastName, avatar, shopName, area } = req.body;
  const set = {};
  if (firstName !== undefined) { if (!clean(firstName, 50)) return fail(res, 400, 'First name is required'); set.firstName = clean(firstName, 50); }
  if (lastName !== undefined) { if (!clean(lastName, 50)) return fail(res, 400, 'Last name is required'); set.lastName = clean(lastName, 50); }
  if (avatar?.url?.startsWith('https://')) set.avatar = { url: avatar.url, publicId: avatar.publicId };
  if (req.user.roles?.includes('seller')) {
    if (shopName !== undefined) set['seller.shopName'] = clean(shopName, 80);
    if (area !== undefined) set['seller.area'] = clean(area, 80);
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true, runValidators: true }).select('-password');
  res.json({ user });
};

/* ----------------------------- addresses ----------------------------- */

const pick = (b) => ({
  label: clean(b.label, 30) || 'Home',
  line1: clean(b.line1, 200),
  lga: clean(b.lga, 80),
  state: clean(b.state, 50),
  phone: clean(b.phone, 20),
});

export const listAddresses = async (req, res) => {
  const u = await User.findById(req.user._id).select('addresses').lean();
  res.json({ addresses: u?.addresses ?? [] });
};

export const addAddress = async (req, res) => {
  const data = pick(req.body);
  if (data.line1.length < 5) return fail(res, 400, 'Enter the full address');
  const user = await User.findById(req.user._id).select('addresses');
  if (user.addresses.length >= 10) return fail(res, 400, 'You can save up to 10 addresses');
  const makeDefault = !!req.body.isDefault || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push({ ...data, isDefault: makeDefault });
  await user.save();
  res.status(201).json({ addresses: user.addresses });
};

export const updateAddress = async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return fail(res, 404, 'Address not found');
  const data = pick({ ...addr.toObject(), ...req.body });
  if (data.line1.length < 5) return fail(res, 400, 'Enter the full address');
  Object.assign(addr, data);
  if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = String(a._id) === req.params.addrId; });
  await user.save();
  res.json({ addresses: user.addresses });
};

export const deleteAddress = async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return fail(res, 404, 'Address not found');
  const wasDefault = addr.isDefault;
  addr.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  res.json({ addresses: user.addresses });
};
