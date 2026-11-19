import mongoose from "mongoose";
import Product, { PRODUCT_CATEGORIES, MAX_PRODUCT_IMAGES } from "../models/Product.js";
import User from "../models/User.js";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "digzrkdoe";
const CLOUD_PREFIX = `https://res.cloudinary.com/${CLOUD_NAME}/`;

const sellerId = (req) => req.user._id || req.user.id;

/* ----------------------------- validation ----------------------------- */

// Optional non-negative whole number. Empty / null clears it (returns null).
function optionalInt(body, key, errors, label) {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === "" || v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    errors[key] = `${label} must be a whole number, 0 or more`;
    return undefined;
  }
  return n;
}

function parseProduct(body, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const has = (k) => !partial || k in body;

  if (has("name")) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 100) errors.name = "Product name must be 2 to 100 characters";
    else data.name = name;
  }

  if (has("price")) {
    const price = Number(body.price);
    if (body.price === "" || body.price == null || !Number.isFinite(price) || price < 0) {
      errors.price = "Enter a valid price";
    } else data.price = price;
  }

  if (has("category")) {
    const category = String(body.category ?? "").trim().toLowerCase();
    if (!PRODUCT_CATEGORIES.includes(category)) errors.category = "Choose a category";
    else data.category = category;
  }

  if ("description" in body) {
    const d = String(body.description ?? "").trim();
    if (d.length > 1000) errors.description = "Description is too long (max 1000 characters)";
    else data.description = d;
  }

  if (has("images")) {
    const imgs = body.images;
    if (!Array.isArray(imgs) || imgs.length < 1) errors.images = "Add at least one image";
    else if (imgs.length > MAX_PRODUCT_IMAGES) errors.images = `You can add up to ${MAX_PRODUCT_IMAGES} images`;
    else if (!imgs.every((i) => typeof i?.url === "string" && i.url.startsWith(CLOUD_PREFIX))) {
      errors.images = "Images must be uploaded to Cloudinary first";
    } else {
      data.images = imgs.map((i) => ({ url: i.url, publicId: i.publicId }));
    }
  }

  const stock = optionalInt(body, "stockQuantity", errors, "Stock quantity");
  if (stock !== undefined) data.stockQuantity = stock;
  const low = optionalInt(body, "lowStockAlert", errors, "Low stock alert");
  if (low !== undefined) data.lowStockAlert = low;

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  return { errors, data };
}

const fail = (res, errors) =>
  res.status(400).json({ message: Object.values(errors)[0] || "Invalid product details", errors });

/* ----------------------------- handlers ----------------------------- */

export async function createProduct(req, res, next) {
  try {
    const { errors, data } = parseProduct(req.body);
    if (Object.keys(errors).length) return fail(res, errors);

    const product = await Product.create({ ...data, seller: sellerId(req) });
    res.status(201).json({ product });
  } catch (e) {
    next(e);
  }
}

export async function listMyProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { seller: sellerId(req) };
    if (req.query.category) filter.category = String(req.query.category).toLowerCase();

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({ products, page, limit, total, hasMore: page * limit < total });
  } catch (e) {
    next(e);
  }
}

// Everything the seller dashboard needs in one request.
export async function mySummary(req, res, next) {
  try {
    const seller = new mongoose.Types.ObjectId(String(sellerId(req)));
    const isNum = (f) => ({ $isNumber: f });

    const lowStockExpr = {
      $expr: {
        $and: [isNum("$stockQuantity"), isNum("$lowStockAlert"), { $lte: ["$stockQuantity", "$lowStockAlert"] }],
      },
    };

    const [agg, recent, lowStock] = await Promise.all([
      Product.aggregate([
        { $match: { seller } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            outOfStock: {
              $sum: { $cond: [{ $and: [isNum("$stockQuantity"), { $lte: ["$stockQuantity", 0] }] }, 1, 0] },
            },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      isNum("$stockQuantity"),
                      isNum("$lowStockAlert"),
                      { $gt: ["$stockQuantity", 0] },
                      { $lte: ["$stockQuantity", "$lowStockAlert"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Product.find({ seller }).sort({ createdAt: -1 }).limit(5),
      Product.find({ seller, ...lowStockExpr }).sort({ stockQuantity: 1 }).limit(5),
    ]);

    const s = agg[0] || {};
    res.json({
      stats: {
        total: s.total || 0,
        active: s.active || 0,
        outOfStock: s.outOfStock || 0,
        lowStock: s.lowStock || 0,
      },
      recent,
      lowStock,
    });
  } catch (e) {
    next(e);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: sellerId(req) });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { errors, data } = parseProduct(req.body, { partial: true });
    if (Object.keys(errors).length) return fail(res, errors);

    product.set(data);
    await product.save();
    res.json({ product });
  } catch (e) {
    next(e);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, seller: sellerId(req) });
    if (!product) return res.status(404).json({ message: "Product not found" });
    // Note: deleting the image files from Cloudinary needs your API secret (server side only).
    // The publicIds are stored on the product if you want to add that later.
    res.json({ message: "Product deleted" });
  } catch (e) {
    next(e);
  }
}

/* ----------------------------- public (no login) ----------------------------- */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

// Joins the seller, hides products of blocked / deleted / inactive sellers,
// and exposes only safe seller fields (never phone, email, wallet, etc.).
function publicPipeline(match) {
  return [
    { $match: { isActive: true, ...match } },
    {
      $lookup: {
        from: User.collection.name,
        localField: "seller",
        foreignField: "_id",
        as: "seller",
        pipeline: [
          { $match: { isActive: true, isDeleted: { $ne: true }, "blocked.isBlocked": { $ne: true } } },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              avatar: 1,
              "seller.businessName": 1,
              "seller.sellerType": 1,
              "seller.marketOrShop": 1,
              "seller.rating": 1,
              "seller.fulfilment": 1,
              "location.state": 1,
              "location.area": 1,
              "verification.status": 1,
            },
          },
        ],
      },
    },
    { $unwind: "$seller" }, // drops products whose seller didn't pass the match above
    {
      $addFields: {
        inStock: {
          $or: [{ $not: [{ $isNumber: "$stockQuantity" }] }, { $gt: ["$stockQuantity", 0] }],
        },
      },
    },
    { $project: { lowStockAlert: 0, isActive: 0, __v: 0 } }, // lowStockAlert is private to the seller
  ];
}

// GET /api/products?q=rice&category=grains&seller=<id>&minPrice=1000&maxPrice=50000
//                  &inStock=true&sort=newest|price_asc|price_desc&page=1&limit=20
export async function listProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { q, category, seller, minPrice, maxPrice, inStock, sort } = req.query;

    const match = {};
    if (q) match.name = { $regex: escapeRegex(String(q).trim().slice(0, 60)), $options: "i" };
    if (category) match.category = String(category).toLowerCase();
    if (seller) {
      if (!isObjectId(seller)) return res.status(400).json({ message: "Invalid seller id" });
      match.seller = new mongoose.Types.ObjectId(String(seller));
    }
    const lo = Number(minPrice);
    const hi = Number(maxPrice);
    if ((minPrice !== undefined && minPrice !== "" && Number.isFinite(lo)) || (maxPrice !== undefined && maxPrice !== "" && Number.isFinite(hi))) {
      match.price = {};
      if (minPrice !== undefined && minPrice !== "" && Number.isFinite(lo)) match.price.$gte = lo;
      if (maxPrice !== undefined && maxPrice !== "" && Number.isFinite(hi)) match.price.$lte = hi;
    }
    if (inStock === "true") {
      match.$or = [{ stockQuantity: null }, { stockQuantity: { $gt: 0 } }];
    }

    const sortStage =
      sort === "price_asc" ? { price: 1, _id: 1 } : sort === "price_desc" ? { price: -1, _id: 1 } : { createdAt: -1, _id: -1 };

    const [out] = await Product.aggregate([
      ...publicPipeline(match),
      {
        $facet: {
          items: [{ $sort: sortStage }, { $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: "total" }],
        },
      },
    ]);
  
    const total = out?.count?.[0]?.total || 0;

    res.json({ products: out?.items || [], page, limit, total, hasMore: page * limit < total });
  } catch (e) {
    next(e);
  }
}

// GET /api/products/:id
export async function getProduct(req, res, next) {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const [product] = await Product.aggregate([
      ...publicPipeline({ _id: new mongoose.Types.ObjectId(req.params.id) }),
      { $limit: 1 },
    ]);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ product });
  } catch (e) {
    next(e);
  }
}

// GET /api/products/categories
export function listCategories(_req, res) {
  res.json({ categories: PRODUCT_CATEGORIES });
}