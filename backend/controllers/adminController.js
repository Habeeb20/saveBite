import mongoose from "mongoose";
import User from "../models/User.js";

/* ----------------------------- helpers ----------------------------- */

const ROLES = ["buyer", "seller", "rider", "admin"];
const VERIFICATION = ["unverified", "pending", "verified", "rejected"];

// countDocuments / aggregate skip the model's soft-delete hook (it only covers find*),
// so deleted users are excluded explicitly everywhere.
const notDeleted = { isDeleted: { $ne: true } };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only what the table needs. Wallet transactions, sessions, OTP, biometric data are never listed.
const LIST_FIELDS = [
    "firstName",
    "lastName",
    "username",
    "email",
    "phone",
    "roles",
    "activeRole",
    "avatar",
    "location.state",
    "location.lga",
    "location.area",
    "seller.businessName",
    "seller.sellerType",
    "verification.status",
    "verification.verifiedAt",
    "blocked.isBlocked",
    "blocked.reason",
    "isActive",
    "wallet.balance",
    "lastLoginAt",
    "createdAt",
].join(" ");

const SORTS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { firstName: 1, lastName: 1 },
    lastLogin: { lastLoginAt: -1 },
};

// Small payload returned after an action so the UI can update without a refetch.
const actionState = (user) => ({
    _id: user._id,
    verification: user.verification,
    blocked: user.blocked,
});

const serverError = (res, err) => {
    console.error("[adminUser]", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
};

// Sends the error response itself and returns null when the user can't be used.
const loadUser = async (req, res, select) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({ message: "Invalid user id" });
        return null;
    }
    const query = User.findById(id);
    if (select) query.select(select);
    const user = await query;
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return null;
    }
    return user;
};

const cleanReason = (value) => (typeof value === "string" ? value.trim() : "");

/* ----------------------------- queries ----------------------------- */

// GET /api/admin?page=1&limit=20&search=&role=&verification=&status=&sort=
export const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const { search, role, verification, status, sort } = req.query;

        const filter = { ...notDeleted };
        if (ROLES.includes(role)) filter.roles = role;
        if (VERIFICATION.includes(verification)) filter["verification.status"] = verification;
        if (status === "blocked") filter["blocked.isBlocked"] = true;
        if (status === "active") filter["blocked.isBlocked"] = { $ne: true };

        const term = typeof search === "string" ? search.trim().slice(0, 80) : "";
        if (term) {
            const rx = new RegExp(escapeRegex(term), "i");
            const or = [
                { firstName: rx },
                { lastName: rx },
                { username: rx },
                { email: rx },
                { "seller.businessName": rx },
            ];

            // "John Doe" -> first name + last name
            const [first, ...rest] = term.split(/\s+/);
            if (rest.length) {
                or.push({
                    firstName: new RegExp(escapeRegex(first), "i"),
                    lastName: new RegExp(escapeRegex(rest.join(" ")), "i"),
                });
            }

            // Phones are stored as +234..., so match the digits without the leading 0 or 234
            const digits = term.replace(/\D/g, "").replace(/^(234|0)/, "");
            if (digits.length >= 4) or.push({ phone: new RegExp(escapeRegex(digits)) });

            filter.$or = or;
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select(LIST_FIELDS)
                .sort(SORTS[sort] || SORTS.newest)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        res.json({ users, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /api/admin/stats
export const getUserStats = async (_req, res) => {
    try {
        const count = (extra = {}) => User.countDocuments({ ...notDeleted, ...extra });

        const [total, buyers, sellers, riders, admins, verified, pending, blocked] = await Promise.all([
            count(),
            count({ roles: "buyer" }),
            count({ roles: "seller" }),
            count({ roles: "rider" }),
            count({ roles: "admin" }),
            count({ "verification.status": "verified" }),
            count({ "verification.status": "pending" }),
            count({ "blocked.isBlocked": true }),
        ]);

        res.json({ stats: { total, buyers, sellers, riders, admins, verified, pending, blocked } });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /api/admin/:id  (full profile; toJSON already strips password, OTP, sessions, biometric keys)
export const getUserById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const user = await User.findById(req.params.id)
            .select("-wallet.transactions -buyer.following -buyer.savedPosts -pushTokens")
            .populate("verification.verifiedBy verification.unverifiedBy blocked.blockedBy blocked.unblockedBy", "firstName lastName");

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user });
    } catch (err) {
        serverError(res, err);
    }
};

/* ----------------------------- verification ----------------------------- */

// PATCH /api/admin/:id/verify
export const verifyUser = async (req, res) => {
    try {
        const user = await loadUser(req, res);
        if (!user) return;

        if (user.roles.includes("admin")) {
            return res.status(400).json({ message: "Admin accounts don't need verification" });
        }
        if (user.blocked?.isBlocked) {
            return res.status(400).json({ message: "Unblock this user before verifying them" });
        }
        if (user.verification?.status === "verified") {
            return res.status(400).json({ message: "This user is already verified" });
        }

        user.markVerified(req.user._id);
        // validateBeforeSave: false so an older seller profile with a missing field can't block an admin action
        await user.save({ validateBeforeSave: false });

        res.json({ message: "Verified", user: actionState(user) });
    } catch (err) {
        serverError(res, err);
    }
};

// PATCH /api/admin/:id/unverify   body: { reason }
export const unverifyUser = async (req, res) => {
    try {
        const reason = cleanReason(req.body.reason);
        if (reason.length < 3) {
            return res.status(400).json({ message: "Give a reason for removing verification" });
        }

        const user = await loadUser(req, res);
        if (!user) return;

        if (String(user._id) === String(req.user._id)) {
            return res.status(400).json({ message: "You can't change verification on your own account" });
        }
        if (user.verification?.status !== "verified") {
            return res.status(400).json({ message: "This user is not verified" });
        }

        user.markUnverified(req.user._id, reason);
        await user.save({ validateBeforeSave: false });

        res.json({ message: "Verification removed", user: actionState(user) });
    } catch (err) {
        serverError(res, err);
    }
};

/* ----------------------------- blocking ----------------------------- */

// PATCH /api/admin/:id/block   body: { reason }
export const blockUser = async (req, res) => {
    try {
        const reason = cleanReason(req.body.reason);
        if (reason.length < 3) {
            return res.status(400).json({ message: "Give a reason for blocking this user" });
        }

        // Sessions and biometric keys are select:false, so load them or block() can't clear them.
        const user = await loadUser(req, res, "+security.sessions +security.biometric.credentials");
        if (!user) return;

        if (String(user._id) === String(req.user._id)) {
            return res.status(400).json({ message: "You can't block your own account" });
        }
        if (user.blocked?.isBlocked) {
            return res.status(400).json({ message: "This user is already blocked" });
        }

        user.block(req.user._id, reason);
        await user.save({ validateBeforeSave: false });

        res.json({ message: "Blocked", user: actionState(user) });
    } catch (err) {
        serverError(res, err);
    }
};

// PATCH /api/admin/:id/unblock
export const unblockUser = async (req, res) => {
    try {
        const user = await loadUser(req, res);
        if (!user) return;

        if (!user.blocked?.isBlocked) {
            return res.status(400).json({ message: "This user is not blocked" });
        }

        user.unblock(req.user._id);
        await user.save({ validateBeforeSave: false });

        res.json({ message: "Unblocked", user: actionState(user) });
    } catch (err) {
        serverError(res, err);
    }
};