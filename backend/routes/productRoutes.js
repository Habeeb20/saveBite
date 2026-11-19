import { Router } from "express";
import { protect } from "../middleware/auth.js"; // <- adjust to your auth middleware (must set req.user)
import {
  createProduct,
  listMyProducts,
  mySummary,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  listCategories,
} from "../controllers/productController.js";

const router = Router();

const requireSeller = (req, res, next) => {
  if (!req.user?.roles?.includes("seller")) {
    return res.status(403).json({ message: "Only sellers can manage products" });
  }
  next();
};
const seller = [protect, requireSeller];

/* ---------- seller only (must stay above "/:id") ---------- */
router.get("/mine/summary", ...seller, mySummary);
router.get("/mine", ...seller, listMyProducts);
router.post("/", ...seller, createProduct);
router.patch("/:id", ...seller, updateProduct);
router.delete("/:id", ...seller, deleteProduct);

/* ---------- public (no login needed) ---------- */
router.get("/categories", listCategories);
router.get("/", listProducts);
router.get("/:id", getProduct);

export default router;

// In your app file:
//   import productRoutes from "./routes/productRoutes.js";
//   app.use("/api/products", productRoutes);