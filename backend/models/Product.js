import mongoose from "mongoose";

const { Schema } = mongoose;

export const PRODUCT_CATEGORIES = [
  "grains",
  "tubers",
  "vegetables",
  "fruits",
  "meat",
  "fish",
  "poultry",
  "oils",
  "spices",
  "cooked meals",
  "snacks",
  "drinks",
  "other",
];

export const MAX_PRODUCT_IMAGES = 6;

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true }, // Cloudinary public_id, needed for deletes
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Product name is required"], trim: true, minlength: 2, maxlength: 100 },
    price: { type: Number, required: [true, "Price is required"], min: [0, "Price cannot be negative"] }, // naira
    category: { type: String, required: true, lowercase: true, trim: true, enum: PRODUCT_CATEGORIES },
    description: { type: String, trim: true, maxlength: 1000 },
    images: {
      type: [productImageSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 1 && v.length <= MAX_PRODUCT_IMAGES,
        message: `Add between 1 and ${MAX_PRODUCT_IMAGES} images`,
      },
    },
    // Both optional. null = "not tracking stock".
    stockQuantity: { type: Number, min: 0, default: null },
    lowStockAlert: { type: Number, min: 0, default: null }, // warn when stockQuantity <= this
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ seller: 1, createdAt: -1 });
productSchema.index({ name: "text", description: "text" });

productSchema.virtual("isOutOfStock").get(function () {
  return typeof this.stockQuantity === "number" && this.stockQuantity <= 0;
});
productSchema.virtual("isLowStock").get(function () {
  return (
    typeof this.stockQuantity === "number" &&
    typeof this.lowStockAlert === "number" &&
    this.stockQuantity > 0 &&
    this.stockQuantity <= this.lowStockAlert
  );
});

const clean = (_doc, ret) => {
  delete ret.__v;
  delete ret.id;
  return ret;
};
productSchema.set("toJSON", { virtuals: true, transform: clean });
productSchema.set("toObject", { virtuals: true, transform: clean });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;