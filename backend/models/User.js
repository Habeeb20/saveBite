import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const { Schema } = mongoose;

/* ----------------------------- helpers ----------------------------- */

// 0803 123 4567 | 2348031234567 | +234 803 123 4567  ->  +2348031234567
const normalizePhone = (value) => {
  if (!value) return value;
  const d = String(value).replace(/[\s-]/g, "");
  if (d.startsWith("+234")) return d;
  if (d.startsWith("234")) return `+${d}`;
  if (d.startsWith("0")) return `+234${d.slice(1)}`;
  return d;
};

const PHONE_REGEX = /^\+234[789][01]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SESSIONS = 5;
const MAX_BIOMETRIC_DEVICES = 5;
const BIOMETRIC_CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_EMBEDDED_TX = 200; // embedded wallet history is capped (see note in statics)

/* ----------------------------- sub-schemas ----------------------------- */

const imageSchema = new Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }, // Cloudinary public_id, needed for deletes
  },
  { _id: false }
);

const openingHoursSchema = new Schema(
  {
    day: {
      type: String,
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      required: true,
    },
    open: { type: String, match: TIME_REGEX }, // "08:00"
    close: { type: String, match: TIME_REGEX }, // "20:00"
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const verificationDocSchema = new Schema(
  {
    kind: {
      type: String,
      enum: [
        "shop_photo",
        "market_stall",
        "business_reg",
        "food_permit",
        "id_card",
        "drivers_license",
        "vehicle_papers",
      ],
      required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true }, // hash of the refresh token
    device: { type: String, trim: true },
    ip: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: true }
);

// One entry per device. The private key never leaves the phone's secure hardware.
const biometricCredentialSchema = new Schema(
  {
    keyId: { type: String, required: true },
    publicKey: { type: String, required: true }, // PEM, or base64 DER (SPKI)
    biometricType: {
      type: String,
      enum: ["fingerprint", "face", "iris", "unknown"],
      default: "unknown",
    },
    deviceId: { type: String, trim: true },
    deviceName: { type: String, trim: true },
    platform: { type: String, enum: ["ios", "android"] },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { _id: false }
);

const walletTransactionSchema = new Schema(
  {
    type: { type: String, enum: ["credit", "debit", "balance_check"], required: true },
    amount: { type: Number, min: 0 },
    provider: { type: String },
    reference: { type: String },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    details: Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const geoPointSchema = {
  type: { type: String, enum: ["Point"] },
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
};

/* ----------------------------- main schema ----------------------------- */

const userSchema = new Schema(
  {
    /* ---------- identity ---------- */
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-z0-9_.]+$/, "Username can only contain letters, numbers, _ and ."],
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      set: normalizePhone,
      match: [PHONE_REGEX, "Enter a valid Nigerian phone number"],
      unique: true,
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Enter a valid email address"],
      unique: true,
      sparse: true, // email is optional, but unique when present
    },
     address: { type: String, trim: true, maxlength: 200 },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
txPin: { hash: String, fails: { type: Number, default: 0 }, lockedUntil: Date, setAt: Date },
    notifications: {
  chat: { type: Boolean, default: true },
  priceAlerts: { type: Boolean, default: true },
  ajoReminders: { type: Boolean, default: true },
  promotions: { type: Boolean, default: false },
  push: { type: Boolean, default: false },          // NEW: master switch, set when the user turns push on
  followedPosts: { type: Boolean, default: true },  // NEW: posts from people I follow
  social: { type: Boolean, default: true },         // NEW: likes, comments, reposts, new followers
},
    avatar: imageSchema,
    bio: { type: String, trim: true, maxlength: 280 },

    /* ---------- roles ---------- */
    // One account can hold several roles (e.g. buyer + seller).
    roles: {
      type: [String],
      enum: ["buyer", "seller", "rider", "admin"],
      default: ["buyer"],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A user must have at least one role",
      },
    },
    activeRole: {
      type: String,
      enum: ["buyer", "seller", "rider", "admin"],
      default: "buyer",
    },


    avatar: { url: String, publicId: String },
lastSeen: Date,
notificationsEnabled: { type: Boolean, default: false },

addresses: [{
  label: String, line1: String, lga: String, state: String, phone: String,
  isDefault: { type: Boolean, default: false },
}],
buyer:  { following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
          savedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }] },
seller: { shopName: String, area: String,
          followersCount: { type: Number, default: 0 },
          postsCount: { type: Number, default: 0 } },

    /* ---------- location (feed, "near me", delivery) ---------- */
    location: {
      state: { type: String, trim: true },
      lga: { type: String, trim: true },
      area: { type: String, trim: true }, // e.g. "Ikeja", "Mile 12"
     
      geo: geoPointSchema,
    },

    biometricDevices: {
  type: [
    {
      tokenHash: { type: String, required: true, index: true },
      deviceName: String,
      createdAt: { type: Date, default: Date.now },
      lastUsedAt: Date,
    },
  ],
  default: [],
  select: false, // keeps the hashes out of every `res.json({ user })`
},

    /* ---------- seller profile ---------- */
    seller: {
      businessName: { type: String, trim: true, maxlength: 100 },
      sellerType: { type: String, enum: ["foodstuff", "cooked", "both", "other"] },
      description: { type: String, trim: true, maxlength: 500 },
      categories: [{ type: String, trim: true, lowercase: true }], // grains, tubers, meat, jollof...
      marketOrShop: { type: String, trim: true }, // "Mile 12 Market, Stall 14"
      whatsapp: { type: String, set: normalizePhone },
      coverImage: imageSchema,
      openingHours: [openingHoursSchema],
      fulfilment: {
        pickup: { type: Boolean, default: true },
        delivery: { type: Boolean, default: false },
        deliveryAreas: [{ type: String, trim: true }],
      },
      rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0, min: 0 },
      },
      followersCount: { type: Number, default: 0, min: 0 },
      postsCount: { type: Number, default: 0, min: 0 },
    },


    /* ---------- rider profile ---------- */
    rider: {
      vehicleType: { type: String, enum: ["bicycle", "motorbike", "tricycle", "car", "van"] },
      vehicleDescription: { type: String, trim: true, maxlength: 100 },
      plateNumber: { type: String, trim: true, uppercase: true },
      serviceAreas: [{ type: String, trim: true }],
      isAvailable: { type: Boolean, default: false },
      currentLocation: {
        ...geoPointSchema,
        updatedAt: { type: Date },
      },
      rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0, min: 0 },
      },
      completedDeliveries: { type: Number, default: 0, min: 0 },
    },

    /* ---------- buyer profile ---------- */
    buyer: {
      following: [{ type: Schema.Types.ObjectId, ref: "User" }], // sellers followed
      savedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
      preferredCategories: [{ type: String, trim: true, lowercase: true }],
    },

    /* ---------- admin: verification and blocking (any role) ---------- */
    verification: {
      status: {
        type: String,
        enum: ["unverified", "pending", "verified", "rejected"],
        default: "unverified",
      },
      documents: [verificationDocSchema],
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
      unverifiedAt: Date,
      unverifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reason: { type: String, trim: true }, // why rejected / unverified
    },
    blocked: {
      isBlocked: { type: Boolean, default: false },
      reason: { type: String, trim: true },
      blockedAt: Date,
      blockedBy: { type: Schema.Types.ObjectId, ref: "User" },
      unblockedAt: Date,
      unblockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },

    /* ---------- wallet ---------- */
    wallet: {
      balance: { type: Number, default: 0, min: 0 },
      transactions: { type: [walletTransactionSchema], default: [] },
    },
    paystackCustomerId: { type: String },
    virtualAccountDetails: {
      account_number: { type: String },
      account_name: { type: String },
      bank: { type: String },
    },
    paylonyVirtualAccountDetails: {
      account_number: { type: String },
      account_name: { type: String },
      bank_name: { type: String },
      provider: { type: String },
      domain: { type: String },
      reference: { type: String },
      assignment: { type: String },
      status: { type: String },
      mandate: { reference: String, status: String, createdAt: Date },
    },

    /* ---------- notifications and preferences ---------- */
    pushTokens: [
      {
        token: { type: String, required: true }, // Expo push token
        platform: { type: String, enum: ["ios", "android"] },
        addedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  
    preferences: {
      notifications: {
        chat: { type: Boolean, default: true },
        priceAlerts: { type: Boolean, default: true },
        ajoReminders: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false },
      },
      language: { type: String, enum: ["en", "yo", "ig", "ha", "pcm"], default: "en" },
    },

    /* ---------- security ---------- */
    security: {
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
      // Never store BVN/NIN in plain text. Keep only the result of a check
      // done through a licensed provider.
      identityVerified: { type: Boolean, default: false },
      twoFactorSecret: { type: String, select: false },

      // One-time codes: phone/email verification, login code, password reset
      otp: {
        codeHash: { type: String, select: false },
        purpose: { type: String, enum: ["phone_verify", "email_verify", "login", "reset"] },
        expiresAt: { type: Date, select: false },
        attempts: { type: Number, default: 0, select: false },
        lastSentAt: { type: Date },
      },

      // Fingerprint / Face ID login (device-bound key pair, challenge-response)
      biometric: {
        enabled: { type: Boolean, default: false },
        credentials: { type: [biometricCredentialSchema], select: false },
        challenge: {
          value: { type: String, select: false },
          keyId: { type: String, select: false },
          expiresAt: { type: Date, select: false },
        },
      },

      passwordChangedAt: { type: Date },
      loginAttempts: { type: Number, default: 0 },
      lockUntil: { type: Date },
      sessions: { type: [sessionSchema], select: false },
    },

    /* ---------- account state ---------- */
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    referralCode: { type: String, unique: true, sparse: true },

    /* ---------- offline / sync support ---------- */
    sync: {
      version: { type: Number, default: 0 }, // bumps on every save, lets the app detect changes
      lastSyncedAt: { type: Date },
    },
  },
  { timestamps: true }
);

/* ----------------------------- indexes ----------------------------- */

userSchema.index({ "location.geo": "2dsphere" });
userSchema.index({ "rider.currentLocation": "2dsphere" });
userSchema.index({ roles: 1, isActive: 1, isDeleted: 1 });
userSchema.index({ "blocked.isBlocked": 1 });
userSchema.index({ "verification.status": 1, roles: 1 });
userSchema.index({
  "seller.sellerType": 1,
  "location.state": 1,
  "location.area": 1,
});
userSchema.index({ "rider.isAvailable": 1, "rider.serviceAreas": 1 });
userSchema.index({ updatedAt: 1 }); // delta sync: "give me changes since..."
userSchema.index({ firstName: "text", lastName: "text", "seller.businessName": "text" });

/* ----------------------------- virtuals ----------------------------- */

userSchema.virtual("fullName").get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(" ");
});
userSchema.virtual("isSeller").get(function () {
  return this.roles.includes("seller");
});
userSchema.virtual("isRider").get(function () {
  return this.roles.includes("rider");
});
userSchema.virtual("isAdmin").get(function () {
  return this.roles.includes("admin");
});
userSchema.virtual("isVerified").get(function () {
  return this.verification?.status === "verified";
});
userSchema.virtual("isLocked").get(function () {
  return Boolean(this.security?.lockUntil && this.security.lockUntil > Date.now());
});
// One check for the login route
userSchema.virtual("canLogin").get(function () {
  return (
    this.isActive &&
    !this.isDeleted &&
    !this.blocked?.isBlocked &&
    !this.isLocked
  );
});

/* ----------------------------- hooks ----------------------------- */

// Hide soft-deleted users from every find, unless .setOptions({ withDeleted: true })
userSchema.pre(/^find/, function () {
  if (!this.getOptions().withDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// Role-specific required fields
userSchema.pre("validate", function () {
  if (this.roles.includes("seller")) {
    if (!this.seller?.businessName) {
      this.invalidate("seller.businessName", "Business name is required for sellers");
    }
    if (!this.seller?.sellerType) {
      this.invalidate("seller.sellerType", "Seller type is required (foodstuff or cooked)");
    }
  }
  if (this.roles.includes("rider") && !this.rider?.vehicleType) {
    this.invalidate("rider.vehicleType", "Vehicle type is required for riders");
  }
  if (!this.roles.includes(this.activeRole)) {
    this.activeRole = this.roles[0];
  }
});

// Hash the password only when it changes
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) {
    // 1s back so a token issued right after the change is still valid
    this.security.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

// Referral code + sync version
userSchema.pre("save", function () {
  if (this.isNew && !this.referralCode) {
    this.referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  }
  if (!this.isNew) this.sync.version = (this.sync.version || 0) + 1;
});

/* ----------------------------- password and lockout ----------------------------- */

userSchema.methods.comparePassword = function (candidate) {
  // Load the user with .select("+password") before calling this.
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.changedPasswordAfter = function (jwtIssuedAt) {
  if (!this.security.passwordChangedAt) return false;
  return jwtIssuedAt < Math.floor(this.security.passwordChangedAt.getTime() / 1000);
};

userSchema.methods.registerFailedLogin = async function () {
  const lockExpired = this.security.lockUntil && this.security.lockUntil < Date.now();
  if (lockExpired) {
    this.security.loginAttempts = 1;
    this.security.lockUntil = undefined;
  } else {
    this.security.loginAttempts += 1;
    if (this.security.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.security.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    }
  }
  return this.save({ validateBeforeSave: false });
};

userSchema.methods.registerSuccessfulLogin = async function () {
  this.security.loginAttempts = 0;
  this.security.lockUntil = undefined;
  this.lastLoginAt = new Date();
  return this.save({ validateBeforeSave: false });
};

/* ----------------------------- one-time codes ----------------------------- */

userSchema.methods.canSendOtp = function (cooldownMs = 60 * 1000) {
  const last = this.security.otp?.lastSentAt;
  return !last || Date.now() - last.getTime() >= cooldownMs;
};

// Returns the plain code to send by SMS/email; only the hash is stored.
userSchema.methods.createOtp = function (purpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  this.security.otp = {
    codeHash: sha256(code),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(),
  };
  return code;
};

// Load the user with:
// .select("+security.otp.codeHash +security.otp.expiresAt +security.otp.attempts")
userSchema.methods.verifyOtp = async function (code, purpose) {
  const otp = this.security.otp;
  if (!otp?.codeHash || otp.purpose !== purpose) return false;
  if (!otp.expiresAt || otp.expiresAt < Date.now()) return false;
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return false;

  if (sha256(code) !== otp.codeHash) {
    this.security.otp.attempts += 1;
    await this.save({ validateBeforeSave: false });
    return false;
  }

  this.security.otp = undefined; // one-time use
  if (purpose === "phone_verify") this.security.phoneVerified = true;
  if (purpose === "email_verify") this.security.emailVerified = true;
  await this.save({ validateBeforeSave: false });
  return true;
};

/* ----------------------------- refresh-token sessions ----------------------------- */

userSchema.methods.addSession = function ({ token, device, ip, ttlMs }) {
  const sessions = this.security.sessions || [];
  sessions.push({
    tokenHash: sha256(token),
    device,
    ip,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  this.security.sessions = sessions.slice(-MAX_SESSIONS);
};

userSchema.methods.hasSession = function (token) {
  const hash = sha256(token);
  return (this.security.sessions || []).some(
    (s) => s.tokenHash === hash && s.expiresAt > Date.now()
  );
};

userSchema.methods.removeSession = function (token) {
  const hash = sha256(token);
  this.security.sessions = (this.security.sessions || []).filter(
    (s) => s.tokenHash !== hash
  );
};

/* ----------------------------- biometric login ----------------------------- */
/*
  Flow (fingerprint or Face ID, whichever the device has):
  1. Register: after the user confirms with their biometric on the phone, the app creates a
     key pair in secure hardware and sends keyId + publicKey (+ biometricType, deviceId).
     Server: user.addBiometricCredential({...}); await user.save()
  2. Login: app sends keyId -> server: const challenge = user.createBiometricChallenge(keyId)
     App asks for the biometric, signs the challenge with the private key, sends the signature.
  3. Server: const ok = await user.verifyBiometricLogin(keyId, signatureBase64)
     If ok, issue tokens exactly like a password login.

  Load the user with: .select("+security.biometric.credentials +security.biometric.challenge.value
                               +security.biometric.challenge.keyId +security.biometric.challenge.expiresAt")
*/

userSchema.methods.addBiometricCredential = function ({
  keyId,
  publicKey,
  biometricType = "unknown",
  deviceId,
  deviceName,
  platform,
}) {
  // Re-registering the same device replaces its old key.
  const kept = (this.security.biometric.credentials || []).filter(
    (c) => c.keyId !== keyId && !(deviceId && c.deviceId === deviceId)
  );
  kept.push({ keyId, publicKey, biometricType, deviceId, deviceName, platform });
  this.security.biometric.credentials = kept.slice(-MAX_BIOMETRIC_DEVICES);
  this.security.biometric.enabled = true;
};

userSchema.methods.createBiometricChallenge = function (keyId) {
  const cred = (this.security.biometric.credentials || []).find(
    (c) => c.keyId === keyId && !c.revokedAt
  );
  if (!cred) return null;
  const value = crypto.randomBytes(32).toString("base64");
  this.security.biometric.challenge = {
    value,
    keyId,
    expiresAt: new Date(Date.now() + BIOMETRIC_CHALLENGE_TTL_MS),
  };
  return value;
};

userSchema.methods.verifyBiometricLogin = async function (keyId, signatureBase64) {
  const b = this.security.biometric;
  const cred = (b.credentials || []).find((c) => c.keyId === keyId && !c.revokedAt);
  const ch = b.challenge;

  if (!cred || !ch?.value || ch.keyId !== keyId || !ch.expiresAt || ch.expiresAt < Date.now()) {
    return false;
  }

  let ok = false;
  try {
    const key = cred.publicKey.includes("BEGIN")
      ? crypto.createPublicKey(cred.publicKey)
      : crypto.createPublicKey({
          key: Buffer.from(cred.publicKey, "base64"),
          format: "der",
          type: "spki",
        });
    ok = crypto.verify(
      "sha256",
      Buffer.from(ch.value),
      key,
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    ok = false;
  }

  this.security.biometric.challenge = undefined; // single use, pass or fail
  if (ok) cred.lastUsedAt = new Date();
  await this.save({ validateBeforeSave: false });
  return ok;
};

userSchema.methods.revokeBiometric = function (keyId) {
  const cred = (this.security.biometric.credentials || []).find((c) => c.keyId === keyId);
  if (cred) cred.revokedAt = new Date();
  this.security.biometric.enabled = (this.security.biometric.credentials || []).some(
    (c) => !c.revokedAt
  );
};

userSchema.methods.revokeAllBiometrics = function () {
  (this.security.biometric.credentials || []).forEach((c) => {
    c.revokedAt = c.revokedAt || new Date();
  });
  this.security.biometric.enabled = false;
};

/* ----------------------------- admin actions ----------------------------- */

const assertNotSelf = (user, adminId) => {
  if (String(user._id) === String(adminId)) {
    throw new Error("Admins cannot perform this action on their own account");
  }
};

userSchema.methods.markVerified = function (adminId) {
  this.verification.status = "verified";
  this.verification.verifiedAt = new Date();
  this.verification.verifiedBy = adminId;
  this.verification.reason = undefined;
};

userSchema.methods.markUnverified = function (adminId, reason) {
  assertNotSelf(this, adminId);
  this.verification.status = "unverified";
  this.verification.unverifiedAt = new Date();
  this.verification.unverifiedBy = adminId;
  this.verification.reason = reason;
};

userSchema.methods.rejectVerification = function (adminId, reason) {
  this.verification.status = "rejected";
  this.verification.unverifiedAt = new Date();
  this.verification.unverifiedBy = adminId;
  this.verification.reason = reason;
};

userSchema.methods.block = function (adminId, reason) {
  assertNotSelf(this, adminId);
  this.blocked = {
    isBlocked: true,
    reason,
    blockedAt: new Date(),
    blockedBy: adminId,
  };
  this.security.sessions = []; // force logout everywhere
  this.revokeAllBiometrics();
  if (this.rider) this.rider.isAvailable = false;
};

userSchema.methods.unblock = function (adminId) {
  this.blocked.isBlocked = false;
  this.blocked.unblockedAt = new Date();
  this.blocked.unblockedBy = adminId;
  this.blocked.reason = undefined;
};

/* ----------------------------- role helpers ----------------------------- */

userSchema.methods.becomeSeller = function ({ businessName, sellerType, ...rest }) {
  if (!this.roles.includes("seller")) this.roles.push("seller");
  this.seller = { ...(this.seller?.toObject?.() ?? {}), businessName, sellerType, ...rest };
  this.activeRole = "seller";
};

userSchema.methods.becomeRider = function ({ vehicleType, plateNumber, ...rest }) {
  if (!this.roles.includes("rider")) this.roles.push("rider");
  this.rider = { ...(this.rider?.toObject?.() ?? {}), vehicleType, plateNumber, ...rest };
  this.activeRole = "rider";
};

userSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedAt = new Date();
  this.security.sessions = [];
  this.revokeAllBiometrics();
};

/* ----------------------------- wallet (atomic) -----------------------------
  Always change the balance with these two statics, never with user.wallet.balance += x; user.save().
  A single atomic update stops two requests from spending the same money.

  Notes:
  - Both return the updated user, or null if nothing was applied (not enough balance,
    or the same `reference` was already recorded, which protects against repeated webhooks).
  - Only the last MAX_EMBEDDED_TX transactions are kept on the user document, so it can't grow
    without limit. Keep the permanent history in a separate Transaction collection.
  - Credits are still allowed for blocked users so incoming deposits are never lost;
    debits are not.
*/

userSchema.statics.creditWallet = function (userId, amount, meta = {}) {
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");

  const filter = { _id: userId };
  if (meta.reference) filter["wallet.transactions.reference"] = { $ne: meta.reference };

  const tx = {
    type: "credit",
    amount,
    status: "success",
    provider: meta.provider,
    reference: meta.reference,
    details: meta.details,
    timestamp: new Date(),
  };

  return this.findOneAndUpdate(
    filter,
    {
      $inc: { "wallet.balance": amount },
      $push: { "wallet.transactions": { $each: [tx], $slice: -MAX_EMBEDDED_TX } },
    },
    { new: true, runValidators: true }
  );
};

userSchema.statics.debitWallet = function (userId, amount, meta = {}) {
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");

  const filter = {
    _id: userId,
    isActive: true,
    "blocked.isBlocked": { $ne: true },
    "wallet.balance": { $gte: amount },
  };
  if (meta.reference) filter["wallet.transactions.reference"] = { $ne: meta.reference };

  const tx = {
    type: "debit",
    amount,
    status: "success",
    provider: meta.provider,
    reference: meta.reference,
    details: meta.details,
    timestamp: new Date(),
  };

  return this.findOneAndUpdate(
    filter,
    {
      $inc: { "wallet.balance": -amount },
      $push: { "wallet.transactions": { $each: [tx], $slice: -MAX_EMBEDDED_TX } },
    },
    { new: true, runValidators: true }
  );
};

/* ----------------------------- output cleanup ----------------------------- */

const stripPrivate = (_doc, ret) => {
  delete ret.password;
  delete ret.__v;
  delete ret.id;
  if (ret.security) {
    delete ret.security.otp;
    delete ret.security.sessions;
    delete ret.security.loginAttempts;
    delete ret.security.lockUntil;
    delete ret.security.twoFactorSecret;
    if (ret.security.biometric) {
      delete ret.security.biometric.credentials;
      delete ret.security.biometric.challenge;
    }
  }
  return ret;
};

userSchema.set("toJSON", { virtuals: true, transform: stripPrivate });
userSchema.set("toObject", { virtuals: true, transform: stripPrivate });

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;