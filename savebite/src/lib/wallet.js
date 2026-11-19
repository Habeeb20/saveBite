import { api } from "./api";

const get = (path) => api(path, { auth: true });
const send = (path, body, method = "POST") => api(path, { method, auth: true, body });

export const walletApi = {
  summary: () => get("/wallet/summary"),
  transactions: (page = 1, kind = "all") => get(`/wallet/transactions?page=${page}&kind=${kind}`),
  banks: () => get("/wallet/banks"),
  verifyAccount: (bank_code, account_number) => send("/wallet/verify-account", { bank_code, account_number }),
  transfer: (body) => send("/wallet/transferfunds", body),
  validateBill: (body) => send("/wallet/validate-bill", body),
  buyAirtime: (body) => send("/wallet/buy-airtime", body),
  buyData: (body) => send("/wallet/buy-data", body),
  buyTv: (body) => send("/wallet/buy-tv-subscription", body),
  buyElectricity: (body) => send("/wallet/buy-electricity", body),
  plans: (key) => get(`/plans/${key}`),
  pinStatus: () => get("/wallet/pin/status"),
  setPin: (pin, currentPin) => send("/wallet/pin", { pin, currentPin }),
};

export const savingsApi = {
  config: () => get("/savings/config"),
  list: () => get("/savings"),
  create: (body) => send("/savings", body),
  get: (id) => get(`/savings/${id}`),
  update: (id, body) => send(`/savings/${id}`, body, "PATCH"),
  deposit: (id, body) => send(`/savings/${id}/deposit`, body),
  preview: (id, amount) => get(`/savings/${id}/withdraw-preview${amount ? `?amount=${amount}` : ""}`),
  withdraw: (id, body) => send(`/savings/${id}/withdraw`, body),
};

// a fresh id for each "attempt", reused if the same request is retried (the server ignores repeats)
export const newRef = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// plan files can differ a little, so read the fields defensively
export const normPlan = (p, kind) => ({
  key: String(p.coded ?? p.id ?? p._id ?? p.name),
  coded: p.coded,
  name: String(p.name ?? ""),
  category: String(p.category || "Plans"),
  price: Number(kind === "tv" ? p.price ?? p.reseller_price : p.reseller_price ?? p.price),
  validity: p.validity ?? p.duration ?? null,
});
