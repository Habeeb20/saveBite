import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { RADIUS_KM, haversineKm, normPlace } from "./geo";

// Change these if your backend uses different routes.
export const ENDPOINTS = {
  products: "/products", // public marketplace listing; supports ?search= & ?category= & ?limit=
  sellers: "/sellers", // optional; if missing, sellers are derived from product.seller
};

const EMOJI = {
  grains: "🌾", tubers: "🍠", vegetables: "🥬", fruits: "🍎", meat: "🥩", fish: "🐟",
  poultry: "🍗", oils: "🫒", spices: "🌶️", "cooked meals": "🍲", snacks: "🍿", drinks: "🥤", other: "🛒",
};

const urlOf = (v) => (typeof v === "string" ? v : v?.url ?? null);
const nameOf = (v) => (typeof v === "string" ? v : v?.name ?? null);
const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

const pickList = (res, key) =>
  Array.isArray(res) ? res
  : Array.isArray(res?.[key]) ? res[key]
  : Array.isArray(res?.data) ? res.data
  : Array.isArray(res?.data?.[key]) ? res.data[key]
  : [];

/* ---------------------------- normalizers ---------------------------- */

export function normalizeSeller(s) {
  const loc = s.location ?? s.address ?? {};
  let lat = num(s.latitude ?? s.lat ?? loc.lat ?? loc.latitude ?? loc.coordinates?.lat);
  let lng = num(s.longitude ?? s.lng ?? loc.lng ?? loc.longitude ?? loc.coordinates?.lng);
  // GeoJSON point: [lng, lat]
  if ((lat === null || lng === null) && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    lng = num(loc.coordinates[0]);
    lat = num(loc.coordinates[1]);
  }
  const fullName = [s.firstName, s.lastName].filter(Boolean).join(" ");
  return {
    id: String(s._id ?? s.id),
    name: s.shopName ?? s.businessName ?? s.name ?? (fullName || "Seller"),
    avatar: urlOf(s.avatar) ?? urlOf(s.logo) ?? urlOf(s.photo),
    rating: num(s.rating ?? s.averageRating),
    lga: nameOf(loc.lga) ?? s.lga ?? null,
    state: nameOf(loc.state) ?? s.state ?? null,
    lat,
    lng,
  };
}

export function normalizeProduct(p) {
  
    console.log(seller)
  const seller = p.seller && typeof p.seller === "object" ? normalizeSeller(p.seller) : null;
  const sellerId = seller?.id ?? (p.seller ? String(p.seller) : p.sellerId ? String(p.sellerId) : null);
  return {
    id: String(p._id ?? p.id),
    name: p.name ?? "",
    price: Number(p.price) || 0,
    old: num(p.oldPrice ?? p.compareAtPrice),
    cat: p.category ?? "other",
    description: p.description ?? "",
    image: urlOf(p.images?.[0]) ?? urlOf(p.image),
    emoji: EMOJI[p.category] ?? "🛒",
    tint: "#FFF3E6",
    stock: num(p.stockQuantity),
    seller: sellerId,
    sellerName: seller?.name ?? p.sellerName ?? p.shopName ?? "",
    shopName:seller?.shopName ?? seller?.businessName ?? seller?.seller?.businessName ?? p?.seller?.seller?.businessName ?? "",
    _seller: seller,
  };
}

/* ------------------------------ search ------------------------------ */

export const tokenize = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);

export function matchesProduct(p, tokens, category) {
  if (category !== "all" && p.cat !== category) return false;
  if (!tokens.length) return true;
  const hay = `${p.name} ${p.cat} ${p.description} ${p.sellerName}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/* ------------------------- sellers near the user ------------------------- */

export function rankSellers(sellers, coords, nearby, place) {
  if (!coords) return [];
  const byLga = new Map(nearby.map((n) => [normPlace(n.name), n.km]));
  const here = place?.lga ? normPlace(place.lga) : null;

  return sellers
    .map((s) => {
      let km = null;
      let approx = false;
      if (s.lat !== null && s.lng !== null) {
        km = haversineKm(coords, { lat: s.lat, lng: s.lng });
      } else if (s.lga) {
        const key = normPlace(s.lga);
        if (here && key === here) { km = 0; approx = true; }
        else if (byLga.has(key)) { km = byLga.get(key); approx = true; }
      }
      return { ...s, km, approx };
    })
    .filter((s) => s.km !== null && s.km <= RADIUS_KM)
    .sort((a, b) => a.km - b.km);
}

/* ------------------------------- hook ------------------------------- */

export function useMarket({ search, category }) {
  const [products, setProducts] = useState([]);
  const [apiSellers, setApiSellers] = useState([]);
  const [knownSellers, setKnownSellers] = useState({}); // derived from products, accumulates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const loadProducts = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      let qs = "limit=100";
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (category && category !== "all") qs += `&category=${encodeURIComponent(category)}`;
      const res = await api(`${ENDPOINTS.products}?${qs}`, { auth: true });
      if (id !== reqId.current) return; // a newer request replaced this one
      const list = pickList(res, "products").map(normalizeProduct);
      setProducts(list);
      setKnownSellers((prev) => {
        const next = { ...prev };
        list.forEach((p) => p._seller && (next[p._seller.id] = p._seller));
        return next;
      });
    } catch (e) {
      if (id === reqId.current) setError(e?.message || "Couldn't load products");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [search, category]);

  const loadSellers = useCallback(async () => {
    try {
      const res = await api(ENDPOINTS.sellers, { auth: true });
      setApiSellers(pickList(res, "sellers").map(normalizeSeller));
    } catch {
      setApiSellers([]); // fall back to sellers found on products
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadSellers(); }, [loadSellers]);

  const reload = useCallback(() => Promise.all([loadProducts(), loadSellers()]), [loadProducts, loadSellers]);

  const sellers = apiSellers.length ? apiSellers : Object.values(knownSellers);

  return { products, sellers, loading, error, reload };
}