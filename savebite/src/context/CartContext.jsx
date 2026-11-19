import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const EMPTY = { items: [], totalAmount: 0, itemCount: 0, fulfillmentType: "delivery", paymentMethod: "online", pickup: { pickedUpBy: "self" }, delivery: {} };

const withTotals = (c) => ({
  ...c,
  totalAmount: c.items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0),
  itemCount: c.items.reduce((n, i) => n + i.quantity, 0),
});

const sameLine = (a) => (b) =>
  String(a.product) === String(b.product) && (a.variety?.name || "") === (b.variety?.name || "");

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id ?? user?.id;

  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const serverCart = useRef(EMPTY); // last cart the server confirmed
  const queue = useRef(Promise.resolve()); // cart changes are sent one at a time, in order
  const pending = useRef(0);

  const apply = useCallback((c) => { serverCart.current = c; setCart(c); }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try { apply((await api("/cart", { auth: true })).cart); } catch {} finally { setLoading(false); }
  }, [userId, apply]);

  useEffect(() => {
    if (!userId) { apply(EMPTY); return; }
    refresh();
  }, [userId, refresh, apply]);

  // update the screen instantly, then confirm with the server (and roll back on error)
  const run = useCallback((optimistic, request) => {
    setCart((c) => withTotals(optimistic(c)));
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        const r = await request();
        serverCart.current = r.cart;
        if (pending.current === 1) setCart(r.cart); // last one in line: show the server's truth
      } catch (e) {
        setCart(serverCart.current);
        Alert.alert("Cart", e?.message || "Couldn't update your cart.");
      } finally { pending.current -= 1; }
    });
    return queue.current;
  }, []);

  const add = useCallback((product) =>
    run(
      (c) => {
        const items = [...c.items];
        const i = items.findIndex((x) => String(x.product) === String(product.id) && !x.variety?.name);
        if (i >= 0) items[i] = { ...items[i], quantity: items[i].quantity + 1 };
        else items.push({ _id: `tmp-${product.id}`, product: product.id, seller: product.seller, name: product.name, price: product.price, image: product.image, quantity: 1 });
        return { ...c, items };
      },
      () => api("/cart/items", { method: "POST", auth: true, body: { productId: product.id, quantity: 1 } })
    ), [run]);

  // change the quantity of one cart line (0 removes it)
  const setLineQty = useCallback((line, n) =>
    run(
      (c) => ({ ...c, items: n <= 0 ? c.items.filter((i) => !sameLine(line)(i)) : c.items.map((i) => (sameLine(line)(i) ? { ...i, quantity: n } : i)) }),
      async () => {
        const item = serverCart.current.items.find(sameLine(line));
        if (!item) return { cart: serverCart.current };
        return n <= 0
          ? api(`/cart/items/${item._id}`, { method: "DELETE", auth: true })
          : api(`/cart/items/${item._id}`, { method: "PATCH", auth: true, body: { quantity: n } });
      }
    ), [run]);

  const setQty = useCallback((productId, n) => setLineQty({ product: productId }, n), [setLineQty]);
  const removeLine = useCallback((line) => setLineQty(line, 0), [setLineQty]);

  const clear = useCallback(() =>
    run((c) => ({ ...c, items: [] }), () => api("/cart", { method: "DELETE", auth: true })), [run]);

  // fulfilment / pickup agent / delivery address / payment method. Throws on error so the screen can show it.
  const updateOptions = useCallback(async (body) => {
    setCart((c) => ({
      ...c,
      ...(body.fulfillmentType && { fulfillmentType: body.fulfillmentType }),
      ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
      ...(body.pickup && { pickup: { ...c.pickup, ...body.pickup } }),
      ...(body.delivery && { delivery: { ...c.delivery, ...body.delivery } }),
    }));
    await queue.current;
    try {
      const r = await api("/cart/options", { method: "PATCH", auth: true, body });
      apply(r.cart);
      return r.cart;
    } catch (e) { setCart(serverCart.current); throw e; }
  }, [apply]);

  const qtyOf = useCallback(
    (productId) => cart.items.filter((i) => String(i.product) === String(productId)).reduce((n, i) => n + i.quantity, 0),
    [cart.items]
  );

  const value = useMemo(
    () => ({ cart, items: cart.items, itemCount: cart.itemCount ?? 0, total: cart.totalAmount ?? 0, loading, qtyOf, add, setQty, setLineQty, removeLine, clear, updateOptions, refresh }),
    [cart, loading, qtyOf, add, setQty, setLineQty, removeLine, clear, updateOptions, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
