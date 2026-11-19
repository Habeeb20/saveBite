import jwt from "jsonwebtoken";
import crypto from "crypto";

const secret = (name, fallback) => {
  const value = process.env[name] || (fallback && process.env[fallback]);
  if (!value) throw new Error(`${name} is not set in your .env file`);
  return value;
};

export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), roles: user.roles }, secret("JWT_ACCESS_SECRET"), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
  });
export const verifyAccessToken = (token) => jwt.verify(token, secret("JWT_ACCESS_SECRET"));

export const signRefreshToken = (user) =>
  jwt.sign({ sub: String(user._id), jti: crypto.randomUUID() }, secret("JWT_REFRESH_SECRET"), {
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
  });
export const verifyRefreshToken = (token) => jwt.verify(token, secret("JWT_REFRESH_SECRET"));

// Proves the email was verified; only valid for finishing the signup.
export const signSignupToken = (email) =>
  jwt.sign({ email, purpose: "signup" }, secret("JWT_SIGNUP_SECRET", "JWT_ACCESS_SECRET"), {
    expiresIn: "30m",
  });
export const verifySignupToken = (token) =>
  jwt.verify(token, secret("JWT_SIGNUP_SECRET", "JWT_ACCESS_SECRET"));
