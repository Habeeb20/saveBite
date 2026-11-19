import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/tokens.js";

// Requires a valid access token: Authorization: Bearer <token>
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Please log in to continue", { code: "NO_TOKEN" });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    // The app uses this to refresh the token silently.
    throw new ApiError(401, "Your session has expired", { code: "TOKEN_EXPIRED" });
  }
  if (!payload.sub) throw new ApiError(401, "Invalid token", { code: "TOKEN_INVALID" });

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "This account no longer exists", { code: "TOKEN_INVALID" });
  if (user.blocked?.isBlocked) {
    throw new ApiError(403, "Your account has been blocked. Please contact support.", {
      code: "ACCOUNT_BLOCKED",
    });
  }
  if (!user.isActive) {
    throw new ApiError(403, "Your account is deactivated.", { code: "ACCOUNT_INACTIVE" });
  }
  if (user.changedPasswordAfter(payload.iat)) {
    throw new ApiError(401, "Password was changed. Please log in again.", { code: "TOKEN_INVALID" });
  }

  req.user = user;
  next();
});

export const restrictTo =
  (...roles) =>
    (req, _res, next) => {
      if (!req.user.roles.some((r) => roles.includes(r))) {
        return next(new ApiError(403, "You do not have permission to do this"));
      }
      next();
    };
