// Sample data so every screen has something to show.
// Replace these with API calls (products, sellers, posts) as the backend gets built.

export const DELIVERY_FEE = 500;

export const CATEGORIES = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "cooked", label: "Cooked", emoji: "🍲" },
  { id: "foodstuff", label: "Foodstuff", emoji: "🌾" },
  { id: "fresh", label: "Fresh", emoji: "🥬" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
  { id: "snacks", label: "Snacks", emoji: "🍪" },
];

export const SELLERS = [
  { id: "s1", name: "Mama Put Kitchen", emoji: "👩🏾‍🍳", rating: 4.8, tint: "#FFEDD5" },
  { id: "s2", name: "Alaba Grains", emoji: "🌾", rating: 4.6, tint: "#FEF3C7" },
  { id: "s3", name: "Fresh Farm Basket", emoji: "🥬", rating: 4.7, tint: "#DCFCE7" },
  { id: "s4", name: "Zobo & Co", emoji: "🥤", rating: 4.5, tint: "#FFE4E6" },
  { id: "s5", name: "Suya Spot", emoji: "🍢", rating: 4.9, tint: "#FEE2E2" },
];

export const PRODUCTS = [
  { id: "p1", name: "Jollof rice & chicken", seller: "s1", cat: "cooked", price: 3500, old: 4200, emoji: "🍛", tint: "#FFEDD5" },
  { id: "p2", name: "Pounded yam & egusi", seller: "s1", cat: "cooked", price: 4000, emoji: "🍲", tint: "#FEF3C7" },
  { id: "p3", name: "Rice, 50kg bag", seller: "s2", cat: "foodstuff", price: 78000, old: 85000, emoji: "🌾", tint: "#FEF9C3" },
  { id: "p4", name: "Oloyin beans, 5 paints", seller: "s2", cat: "foodstuff", price: 9500, emoji: "🫘", tint: "#FFEDD5" },
  { id: "p5", name: "Tomato basket", seller: "s3", cat: "fresh", price: 22000, old: 26000, emoji: "🍅", tint: "#FEE2E2" },
  { id: "p6", name: "Ripe plantain bunch", seller: "s3", cat: "fresh", price: 4500, emoji: "🍌", tint: "#FEF9C3" },
  { id: "p7", name: "Zobo, 1 litre", seller: "s4", cat: "drinks", price: 1200, emoji: "🥤", tint: "#FFE4E6" },
  { id: "p8", name: "Chin chin, family pack", seller: "s4", cat: "snacks", price: 2500, old: 3000, emoji: "🍪", tint: "#FFEDD5" },
  { id: "p9", name: "Suya, 5 sticks", seller: "s5", cat: "cooked", price: 5000, emoji: "🍢", tint: "#FEE2E2" },
  { id: "p10", name: "Crate of eggs", seller: "s2", cat: "foodstuff", price: 4800, old: 5300, emoji: "🥚", tint: "#FEF3C7" },
];

export const POSTS = [
  {
    id: "post1",
    seller: "s1",
    time: "2h",
    text: "Fresh pot of jollof just came off the fire. Smoky, the way you like it. Orders close at 3pm!",
    emoji: "🍛",
    tint: "#FFEDD5",
    likes: 128,
    comments: 24,
    product: "p1",
  },
  {
    id: "post2",
    seller: "s3",
    time: "5h",
    text: "Tomato prices dropped this week. Baskets straight from the farm, delivered same day.",
    emoji: "🍅",
    tint: "#FEE2E2",
    likes: 86,
    comments: 12,
    product: "p5",
  },
  {
    id: "post3",
    seller: "s5",
    time: "1d",
    text: "Friday night suya, extra pepper on request. Tell us how spicy in the chat.",
    emoji: "🍢",
    tint: "#FEF3C7",
    likes: 203,
    comments: 41,
    product: "p9",
  },
];

export const sellerOf = (id) => SELLERS.find((s) => s.id === id);
export const productOf = (id) => PRODUCTS.find((p) => p.id === id);

export const formatNaira = (n) =>
  `₦${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const formatDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};