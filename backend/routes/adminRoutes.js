import express from "express";
import { protect } from "../middleware/auth.js"; // your existing JWT middleware: must set req.user
import {
  getAllUsers,
  getUserStats,
  getUserById,
  verifyUser,
  unverifyUser,
  blockUser,
  unblockUser,
} from "../controllers/adminController.js";

const router = express.Router();

const adminOnly = (req, res, next) => {
  if (req.user?.roles?.includes("admin")) return next();
  return res.status(403).json({ message: "Admin access only" });
};

router.use(protect, adminOnly);

router.get("/stats", getUserStats); // keep above "/:id"
router.get("/", getAllUsers);
router.get("/:id", getUserById);

router.patch("/:id/verify", verifyUser);
router.patch("/:id/unverify", unverifyUser);
router.patch("/:id/block", blockUser);
router.patch("/:id/unblock", unblockUser);

export default router;

