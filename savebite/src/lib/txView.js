import { formatNaira } from "./mockData";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const valid = (d) => {
  if (d === null || d === undefined || d === "") return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export const shortDate = (d) => { const dt = valid(d); return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]}` : ""; };
export const longDate = (d) => { const dt = valid(d); return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : ""; };
export const timeOf = (d) => { const dt = valid(d); return dt ? dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; };

export function dayLabel(d) {
  const dt = valid(d);
  if (!dt) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(dt); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : longDate(dt);
}

// Accepts BOTH shapes and always returns the shape the UI expects:
//  - external wallet API:  { type: "credit"|"debit", timestamp, details: {...} }
//  - local DB record:      { direction, createdAt, recipient: {...}, narration }
// Returns null for anything that isn't an object.
export function normalizeTx(raw) {
  if (!raw || typeof raw !== "object") return null;

  const r = raw.recipient && typeof raw.recipient === "object" ? raw.recipient : {};
  const hasDetails = raw.details && typeof raw.details === "object";

  return {
    ...raw,
    // local records use `direction`; wallet API uses type credit/debit
    type: raw.direction
      ? (raw.direction === "credit" ? "credit" : "debit")
      : raw.type,
    timestamp: raw.timestamp || raw.createdAt || null,
    details: hasDetails
      ? raw.details
      : {
          type: "transfer",
          account_number: r.accountNumber,
          account_name: r.accountName,
          narration: raw.narration,
        },
  };
}

// [{ type:"h", label } , { type:"t", tx } ...] for a sectioned list
export function groupByDay(list) {
  const out = [];
  let last = "";
  (Array.isArray(list) ? list : []).forEach((item) => {
    const tx = normalizeTx(item);
    if (!tx) return;
    const label = dayLabel(tx.timestamp);
    if (label !== last) { out.push({ type: "h", label, key: `h-${label}-${out.length}` }); last = label; }
    out.push({ type: "t", tx, key: tx._id || `${tx.reference || "tx"}-${out.length}` });
  });
  return out;
}

export const freqLabel = (p) =>
  !p?.autoEnabled || p?.frequency === "none" ? "Manual saving" : `${formatNaira(p.autoAmount)} ${p.frequency}`;

const GREEN = ["#16A34A", "#DCFCE7"];
const STYLES = {
  airtime: ["call-outline", "#16A34A", "#DCFCE7"],
  data: ["wifi-outline", "#2563EB", "#DBEAFE"],
  data_pin: ["wifi-outline", "#2563EB", "#DBEAFE"],
  tv_subscription: ["tv-outline", "#9333EA", "#F3E8FF"],
  "electricty-bill": ["flash-outline", "#F59E0B", "#FEF3C7"],
  electricity: ["flash-outline", "#F59E0B", "#FEF3C7"],
  transfer: ["paper-plane-outline", "#475569", "#E2E8F0"],
};

const DEFAULT_META = {
  icon: "arrow-up",
  color: "#DC2626",
  tint: "#FEE2E2",
  title: "Transaction",
  sub: "",
  credit: false,
};

// icon, colours and wording for one wallet transaction. Never throws.
export function txMeta(input) {
  const tx = normalizeTx(input);
  if (!tx) return { ...DEFAULT_META };

  const d = tx.details || {};
  const credit = tx.type === "credit";
  const kind = String(d.type || "");
  let title = credit ? "Money in" : "Money out";
  let sub = "";

  if (kind === "airtime") { title = `Airtime${d.provider ? ` · ${String(d.provider).toUpperCase()}` : ""}`; sub = d.number; }
  else if (kind === "data" || kind === "data_pin") { title = "Data bundle"; sub = d.number; }
  else if (kind === "electricty-bill" || kind === "electricity") { title = "Electricity"; sub = d.number; }
  else if (kind === "tv_subscription") { title = "TV subscription"; sub = d.number; }
  else if (kind === "transfer") { title = "Transfer"; sub = d.account_name || d.account_number; }
  else if (kind === "savings_deposit") { title = `Saved · ${d.plan || "Savings"}`; }
  else if (kind === "savings_auto") { title = `Auto-save · ${d.plan || "Savings"}`; }
  else if (kind === "savings_payout") { title = `Savings payout · ${d.plan || ""}`; }
  else if (kind === "savings_early_withdrawal") { title = `Early withdrawal · ${d.plan || ""}`; sub = d.penalty ? `${formatNaira(d.penalty)} fee` : ""; }
  else if (kind === "savings_reversal") { title = "Savings deposit returned"; }
  else if (credit) { title = tx.provider === "Paystack" ? "Card funding" : "Bank transfer in"; sub = d.narration || ""; }

  const s = STYLES[kind];
  const isSavings = kind.startsWith("savings");
  const icon = s ? s[0] : isSavings ? "leaf-outline" : credit ? "arrow-down" : "arrow-up";
  const color = s ? s[1] : isSavings || credit ? GREEN[0] : "#DC2626";
  const tint = s ? s[2] : isSavings || credit ? GREEN[1] : "#FEE2E2";
  return { icon, color, tint, title: title.trim(), sub: sub || "", credit };
}