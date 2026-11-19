import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { fail } from '../utils/asyncHandler.js';

const MAX_QTY = 99;

const getOrCreate = (buyer) =>
  Cart.findOneAndUpdate({ buyer }, { $setOnInsert: { buyer } }, { upsert: true, new: true });

// How many of this product can the buyer hold? (null stock = unlimited)
const limitFor = (product) =>
  product.stockQuantity === null || product.stockQuantity === undefined ? MAX_QTY : Math.min(MAX_QTY, product.stockQuantity);

// Cart + live info (still in stock? did the price change?) so the app can warn before checkout
async function present(cart) {
  const products = await Product.find({ _id: { $in: cart.items.map((i) => i.product) } })
    .select('price stockQuantity').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const json = cart.toJSON();
  json.items = json.items.map((i) => {
    const p = byId.get(String(i.product));
    return {
      ...i,
      unavailable: !p || p.stockQuantity === 0,
      stockQuantity: p?.stockQuantity ?? null,
      priceChanged: !!p && !i.variety?.name && p.price !== i.price,
      currentPrice: p?.price ?? null,
    };
  });
  json.itemCount = json.items.reduce((n, i) => n + i.quantity, 0);
  return json;
}

async function addOne(cart, buyerId, { productId, quantity = 1, variety }) {
  const product = await Product.findById(productId);
  if (!product) return { error: [404, 'Product not found'] };
  if (String(product.seller) === String(buyerId)) return { error: [400, "You can't buy your own product"] };
  if (product.isActive === false) return { error: [409, 'This product is no longer available'] };

  const max = limitFor(product);
  if (max <= 0) return { error: [409, `${product.name} is out of stock`] };

  let chosen = null;
  if (variety?.name) {
    const options = product.varieties ?? product.variants ?? [];
    chosen = options.find((v) => v.name === variety.name);
    if (!chosen) return { error: [400, 'That option is not available'] };
  }

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const idx = cart.items.findIndex(
    (i) => String(i.product) === String(product._id) && (i.variety?.name || '') === (chosen?.name || '')
  );

  if (idx >= 0) {
    cart.items[idx].quantity = Math.min(cart.items[idx].quantity + qty, max);
    cart.items[idx].price = chosen?.price ?? product.price; // refresh snapshot
  } else {
    cart.items.push({
      product: product._id,
      seller: product.seller,
      quantity: Math.min(qty, max),
      price: chosen?.price ?? product.price,
      name: product.name,
      image: chosen?.image ?? product.images?.[0]?.url,
      ...(chosen && { variety: { name: chosen.name, price: chosen.price, type: chosen.type, image: chosen.image } }),
    });
  }
  return {};
}

export const getCart = async (req, res) => {
  res.json({ cart: await present(await getOrCreate(req.user._id)) });
};

export const addItem = async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const { error } = await addOne(cart, req.user._id, req.body);
  if (error) return fail(res, ...error);
  await cart.save();
  res.status(201).json({ cart: await present(cart) });
};

export const updateItem = async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) return fail(res, 404, 'Item not in your cart');

  const qty = Math.floor(Number(req.body.quantity));
  if (Number.isNaN(qty)) return fail(res, 400, 'Quantity must be a number');
  if (qty <= 0) {
    item.deleteOne();
  } else {
    const product = await Product.findById(item.product).select('stockQuantity price');
    if (!product) { item.deleteOne(); } else {
      const max = limitFor(product);
      if (max <= 0) return fail(res, 409, 'This item is out of stock');
      item.quantity = Math.min(qty, max);
      if (!item.variety?.name) item.price = product.price; // pick up a changed price
    }
  }
  await cart.save();
  res.json({ cart: await present(cart) });
};

export const removeItem = async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) return fail(res, 404, 'Item not in your cart');
  item.deleteOne();
  await cart.save();
  res.json({ cart: await present(cart) });
};

export const clearCart = async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ cart: await present(cart) });
};

// fulfilment / pickup / delivery address / payment method
export const updateOptions = async (req, res) => {
  const { fulfillmentType, pickup, delivery, paymentMethod } = req.body;
  const cart = await getOrCreate(req.user._id);

  if (fulfillmentType !== undefined) {
    if (!['pickup', 'delivery'].includes(fulfillmentType)) return fail(res, 400, 'Invalid fulfilment type');
    cart.fulfillmentType = fulfillmentType;
  }
  if (pickup) {
    const by = pickup.pickedUpBy ?? cart.pickup?.pickedUpBy ?? 'self';
    if (!['self', 'agent'].includes(by)) return fail(res, 400, 'Invalid pickup option');
    if (by === 'agent' && !(pickup.agentName?.trim() && pickup.agentPhone?.trim())) {
      return fail(res, 400, "Enter your agent's name and phone number");
    }
    cart.pickup = {
      pickedUpBy: by,
      agentName: by === 'agent' ? pickup.agentName.trim() : undefined,
      agentPhone: by === 'agent' ? pickup.agentPhone.trim() : undefined,
    };
  }
  if (delivery?.address !== undefined) cart.delivery = { address: String(delivery.address).trim().slice(0, 300) };
  if (paymentMethod !== undefined) {
    if (!['online', 'on_delivery'].includes(paymentMethod)) return fail(res, 400, 'Invalid payment method');
    cart.paymentMethod = paymentMethod;
  }
  await cart.save();
  res.json({ cart: await present(cart) });
};

// Move the phone's local cart into the account cart after login: [{ productId, quantity }]
export const mergeCart = async (req, res) => {
  const list = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
  const cart = await getOrCreate(req.user._id);
  const skipped = [];
  for (const entry of list) {
    const { error } = await addOne(cart, req.user._id, entry);
    if (error) skipped.push({ productId: entry.productId, reason: error[1] });
  }
  await cart.save();
  res.json({ cart: await present(cart), skipped });
};
