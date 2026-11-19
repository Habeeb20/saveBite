

import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  price: Number, // snapshot, refreshed from the live product whenever the cart is read
  name: String,
  image: String,
  // Kept from your schema. Products have no varieties yet, and a client-sent price is never trusted.
  variety: {
    name: String,
    price: Number,
    type: { type: String },
    image: String,
  },
});

const cartSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [cartItemSchema],
    fulfillmentType: { type: String, enum: ["pickup", "delivery"], default: "delivery" },
    pickup: {
      pickedUpBy: { type: String, enum: ["self", "agent"], default: "self" },
      agentPhone: String,
      agentName: String,
    },
    delivery: { address: String },
    paymentMethod: { type: String, enum: ["online", "on_delivery"], default: "online" },
  },
  { timestamps: true }
);

cartSchema.virtual("totalAmount").get(function () {
  return this.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
});
cartSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; delete r.id; return r; } });

export default mongoose.models.Cart || mongoose.model("Cart", cartSchema);