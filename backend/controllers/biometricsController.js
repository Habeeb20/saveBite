import crypto from "crypto";
// Adjust these imports to wherever they live in your project
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { errorHandler } from "../middleware/errorHandler.js";
import ApiError from "../utils/ApiError.js"
import { issueTokens } from "./userController.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const MAX_DEVICES = 5;

const invalid = () =>
  new ApiError(401, "Biometric login is no longer active. Please log in with your password.", {
    code: "BIOMETRIC_INVALID",
  });

/**
 * POST /api/auth/biometric/enable   (protected: user is already logged in)
 * Creates a random device token. Only its hash is stored on the server.
 * The app keeps the raw token in SecureStore and releases it only after
 * a successful fingerprint / face check.
 */
export const enableBiometric = asyncHandler(async (req, res) => {
  const deviceName = String(req.body.deviceName || "Mobile device").slice(0, 60);
  const deviceToken = crypto.randomBytes(32).toString("hex");

  await User.updateOne(
    { _id: req.user._id },
    {
      $push: {
        biometricDevices: {
          $each: [{ tokenHash: sha256(deviceToken), deviceName, createdAt: new Date() }],
          $slice: -MAX_DEVICES, // keep only the newest devices
        },
      },
    }
  );

  res.status(201).json({ success: true, deviceToken });
});

/**
 * POST /api/auth/biometric/login   (public, rate limited)
 * Body: { deviceToken }
 */
export const biometricLogin = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;
  if (!deviceToken || typeof deviceToken !== "string") throw invalid();

  const user = await User.findOneAndUpdate(
    { "biometricDevices.tokenHash": sha256(deviceToken) },
    { $set: { "biometricDevices.$.lastUsedAt": new Date() } },
    { new: true }
  );
  if (!user) throw invalid();

  // Apply the same account checks your password login does, e.g.:
  // if (user.isBlocked) throw new ApiError(403, "Your account is suspended", { code: "ACCOUNT_BLOCKED" });

await user.registerSuccessfulLogin();     
  const tokens = await issueTokens(user, req);
  res.json({ success: true, user, ...tokens });
});

/**
 * POST /api/auth/biometric/disable   (protected)
 * Body: { deviceToken? }  - removes this device, or every device if omitted.
 */
export const disableBiometric = asyncHandler(async (req, res) => {
  const { deviceToken } = req.body;

  const update = deviceToken
    ? { $pull: { biometricDevices: { tokenHash: sha256(String(deviceToken)) } } }
    : { $set: { biometricDevices: [] } };

  await User.updateOne({ _id: req.user._id }, update);
  res.json({ success: true });
});