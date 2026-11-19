import { useCallback, useEffect, useState } from "react";

/* ----------------------------- api ----------------------------- */

// Adjust to your setup: base URL and where your login stores the JWT.
const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const getToken = () => localStorage.getItem("admin_token");

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}/admin${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ----------------------------- helpers ----------------------------- */

const naira = (n) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim();
const yn = (v) => (v ? "Yes" : "No");
const place = (l) => [l?.area, l?.lga, l?.state].filter(Boolean).join(", ") || "—";

function useDebounce(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ROLE_OPTIONS = [["", "All roles"], ["buyer", "Buyers"], ["seller", "Sellers"], ["rider", "Riders"], ["admin", "Admins"]];
const VERIFY_OPTIONS = [["", "Any verification"], ["verified", "Verified"], ["pending", "Pending"], ["unverified", "Unverified"], ["rejected", "Rejected"]];
const STATUS_OPTIONS = [["", "Any status"], ["active", "Active"], ["blocked", "Blocked"]];
const SORT_OPTIONS = [["newest", "Newest first"], ["oldest", "Oldest first"], ["name", "Name A–Z"], ["lastLogin", "Last login"]];

const ACTIONS = {
  verify: {
    title: "Verify user",
    confirm: "Verify",
    needsReason: false,
    tone: "bg-emerald-700 hover:bg-emerald-800",
    body: (n) => `${n} will show as verified in the app.`,
  },
  unverify: {
    title: "Remove verification",
    confirm: "Unverify",
    needsReason: true,
    tone: "bg-amber-600 hover:bg-amber-700",
    body: (n) => `${n} will lose the verified badge. The reason is saved on their account.`,
  },
  block: {
    title: "Block user",
    confirm: "Block",
    needsReason: true,
    tone: "bg-red-600 hover:bg-red-700",
    body: (n) => `${n} will be signed out on every device and won't be able to log in.`,
  },
  unblock: {
    title: "Unblock user",
    confirm: "Unblock",
    needsReason: false,
    tone: "bg-slate-800 hover:bg-slate-900",
    body: (n) => `${n} will be able to log in again.`,
  },
};

/* ----------------------------- small pieces ----------------------------- */

function Avatar({ user, size = "h-10 w-10", text = "text-sm" }) {
  if (user.avatar?.url) {
    return <img src={user.avatar.url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  return (
    <span className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800`}>
      {initials || "?"}
    </span>
  );
}

const VERIFY_STYLES = {
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
  unverified: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function Pill({ className = "", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

const VerifyBadge = ({ status = "unverified" }) => (
  <Pill className={VERIFY_STYLES[status] || VERIFY_STYLES.unverified}>{status[0].toUpperCase() + status.slice(1)}</Pill>
);

const StatusBadge = ({ blocked }) =>
  blocked ? (
    <Pill className="bg-red-50 text-red-700 ring-red-600/20">Blocked</Pill>
  ) : (
    <Pill className="bg-slate-50 text-slate-600 ring-slate-500/20">Active</Pill>
  );

const RolePills = ({ roles = [] }) => (
  <div className="flex flex-wrap gap-1">
    {roles.map((r) => (
      <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize text-slate-700">
        {r}
      </span>
    ))}
  </div>
);

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children ?? "—"}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-slate-200 py-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

/* ----------------------------- action buttons ----------------------------- */

function UserActions({ user, onAction, size = "sm" }) {
  const verified = user.verification?.status === "verified";
  const blocked = user.blocked?.isBlocked;
  const isAdmin = user.roles?.includes("admin");
  const base =
    size === "sm"
      ? "rounded-md px-2 py-1 text-xs font-medium"
      : "rounded-lg px-3 py-2 text-sm font-medium";
  const btn = (type, label, tone) => (
    <button
      key={type}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAction(user, type);
      }}
      className={`${base} ${tone} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!isAdmin &&
        (verified
          ? btn("unverify", "Unverify", "text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50")
          : btn("verify", "Verify", "bg-emerald-700 text-white hover:bg-emerald-800"))}
      {blocked
        ? btn("unblock", "Unblock", "text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50")
        : btn("block", "Block", "text-red-700 ring-1 ring-red-300 hover:bg-red-50")}
    </div>
  );
}

/* ----------------------------- confirm modal ----------------------------- */

function ConfirmModal({ pending, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cfg = ACTIONS[pending.type];
  const name = fullName(pending.user);
  const invalid = cfg.needsReason && reason.trim().length < 3;

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={cfg.title}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{cfg.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{cfg.body(name)}</p>

        {cfg.needsReason && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Reason</span>
            <textarea
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What should be on record?"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </label>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || invalid}
            onClick={submit}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${cfg.tone}`}
          >
            {busy ? "Working…" : cfg.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- detail drawer ----------------------------- */

function UserDrawer({ id, refreshKey, onClose, onAction }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setErr("");
    api(`/${id}`)
      .then((r) => !cancelled && setD(r.user))
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isSeller = d?.roles?.includes("seller");
  const isRider = d?.roles?.includes("rider");
  const account = d?.paylonyVirtualAccountDetails?.account_number
    ? `${d.paylonyVirtualAccountDetails.account_number} · ${d.paylonyVirtualAccountDetails.bank_name || ""}`
    : d?.virtualAccountDetails?.account_number
      ? `${d.virtualAccountDetails.account_number} · ${d.virtualAccountDetails.bank || ""}`
      : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="User details"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">User details</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>

        <div className="px-6 pb-8">
          {err && <p className="py-6 text-sm text-red-600">{err}</p>}
          {!d && !err && <p className="py-6 text-sm text-slate-500">Loading…</p>}

          {d && (
            <>
              <div className="flex items-center gap-4 py-5">
                <Avatar user={d} size="h-16 w-16" text="text-lg" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{fullName(d)}</p>
                  <p className="truncate text-sm text-slate-500">{d.username ? `@${d.username}` : d.email || d.phone}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <RolePills roles={d.roles} />
                    <VerifyBadge status={d.verification?.status} />
                    <StatusBadge blocked={d.blocked?.isBlocked} />
                  </div>
                </div>
              </div>

              <UserActions user={d} onAction={onAction} size="md" />

              {d.blocked?.isBlocked && (
                <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-medium">Blocked on {fmtDate(d.blocked.blockedAt)}</p>
                  <p className="mt-0.5">{d.blocked.reason || "No reason recorded"}</p>
                  {d.blocked.blockedBy && <p className="mt-0.5 text-red-700/80">By {fullName(d.blocked.blockedBy)}</p>}
                </div>
              )}

              <div className="mt-5">
                <Section title="Contact">
                  <Field label="Phone">{d.phone}</Field>
                  <Field label="Email">{d.email}</Field>
                  <Field label="Gender">{d.gender?.replaceAll("_", " ")}</Field>
                  <Field label="Date of birth">{fmtDate(d.dob)}</Field>
                  <Field label="Address">{d.address}</Field>
                  <Field label="Location">{place(d.location)}</Field>
                </Section>

                {isSeller && (
                  <Section title="Seller profile">
                    <Field label="Business">{d.seller?.businessName}</Field>
                    <Field label="Type">{d.seller?.sellerType}</Field>
                    <Field label="Market or shop">{d.seller?.marketOrShop}</Field>
                    <Field label="WhatsApp">{d.seller?.whatsapp}</Field>
                    <Field label="Categories">{d.seller?.categories?.join(", ")}</Field>
                    <Field label="Rating">
                      {d.seller?.rating?.count ? `${d.seller.rating.average.toFixed(1)} (${d.seller.rating.count})` : "No ratings"}
                    </Field>
                    <Field label="Followers">{d.seller?.followersCount}</Field>
                    <Field label="Posts">{d.seller?.postsCount}</Field>
                    <Field label="Pickup">{yn(d.seller?.fulfilment?.pickup)}</Field>
                    <Field label="Delivery">
                      {d.seller?.fulfilment?.delivery ? d.seller.fulfilment.deliveryAreas?.join(", ") || "Yes" : "No"}
                    </Field>
                  </Section>
                )}

                {isRider && (
                  <Section title="Rider profile">
                    <Field label="Vehicle">{[d.rider?.vehicleType, d.rider?.vehicleDescription].filter(Boolean).join(" · ")}</Field>
                    <Field label="Plate number">{d.rider?.plateNumber}</Field>
                    <Field label="Service areas">{d.rider?.serviceAreas?.join(", ")}</Field>
                    <Field label="Available now">{yn(d.rider?.isAvailable)}</Field>
                    <Field label="Deliveries">{d.rider?.completedDeliveries}</Field>
                    <Field label="Rating">
                      {d.rider?.rating?.count ? `${d.rider.rating.average.toFixed(1)} (${d.rider.rating.count})` : "No ratings"}
                    </Field>
                  </Section>
                )}

                <Section title="Wallet">
                  <Field label="Balance">{naira(d.wallet?.balance)}</Field>
                  <Field label="Funding account">{account}</Field>
                </Section>

                <Section title="Verification">
                  <Field label="Status">
                    <VerifyBadge status={d.verification?.status} />
                  </Field>
                  <Field label="Verified on">{fmtDate(d.verification?.verifiedAt)}</Field>
                  <Field label="Verified by">{d.verification?.verifiedBy ? fullName(d.verification.verifiedBy) : null}</Field>
                  <Field label="Reason on record">{d.verification?.reason}</Field>
                </Section>

                {d.verification?.documents?.length > 0 && (
                  <section className="border-t border-slate-200 py-5">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Documents</h3>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {d.verification.documents.map((doc, i) => (
                        <li key={`${doc.url}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="capitalize text-slate-800">{doc.kind.replaceAll("_", " ")}</span>
                          <span className="flex items-center gap-3 text-slate-500">
                            {fmtDate(doc.uploadedAt)}
                            <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 hover:underline">
                              Open
                            </a>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <Section title="Security and activity">
                  <Field label="Phone verified">{yn(d.security?.phoneVerified)}</Field>
                  <Field label="Email verified">{yn(d.security?.emailVerified)}</Field>
                  <Field label="Identity verified">{yn(d.security?.identityVerified)}</Field>
                  <Field label="Biometric login">{yn(d.security?.biometric?.enabled)}</Field>
                  <Field label="Locked out">{yn(d.isLocked)}</Field>
                  <Field label="Last login">{fmtDate(d.lastLoginAt)}</Field>
                  <Field label="Joined">{fmtDate(d.createdAt)}</Field>
                  <Field label="Referral code">{d.referralCode}</Field>
                </Section>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

const DEFAULT_FILTERS = { search: "", role: "", verification: "", status: "", sort: "newest" };

export default function AdminUsers() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0, pages: 1 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [pending, setPending] = useState(null); // { user, type }
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");

  const search = useDebounce(filters.search);

  const loadStats = useCallback(() => {
    api("/stats")
      .then((r) => setStats(r.stats))
      .catch(() => { });
  }, []);
  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ page, limit: 15, sort: filters.sort });
    ["role", "verification", "status"].forEach((k) => filters[k] && qs.set(k, filters[k]));
    if (search.trim()) qs.set("search", search.trim());

    api(`?${qs}`)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, search, filters.role, filters.verification, filters.status, filters.sort]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const runAction = async (reason) => {
    const { user, type } = pending;
    const r = await api(`/${user._id}/${type}`, { method: "PATCH", body: { reason } });
    setData((d) => ({
      ...d,
      users: d.users.map((u) =>
        u._id === user._id
          ? { ...u, verification: { ...u.verification, ...r.user.verification }, blocked: { ...u.blocked, ...r.user.blocked } }
          : u
      ),
    }));
    setRefreshKey((k) => k + 1);
    loadStats();
    setPending(null);
    setToast(r.message);
  };

  // The stat strip doubles as quick filters.
  const segments = stats
    ? [
      { label: "All users", value: stats.total, patch: { role: "", verification: "", status: "" } },
      { label: "Sellers", value: stats.sellers, patch: { role: "seller", verification: "", status: "" } },
      { label: "Buyers", value: stats.buyers, patch: { role: "buyer", verification: "", status: "" } },
      { label: "Awaiting review", value: stats.pending, patch: { role: "", verification: "pending", status: "" } },
      { label: "Verified", value: stats.verified, patch: { role: "", verification: "verified", status: "" } },
      { label: "Blocked", value: stats.blocked, patch: { role: "", verification: "", status: "blocked" } },
    ]
    : [];
  const isActiveSegment = (p) =>
    filters.role === p.role && filters.verification === p.verification && filters.status === p.status;

  const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30";

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Review accounts, verify sellers and buyers, and block or unblock users.</p>
        </header>

        {/* stat strip */}
        <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-6">
          {segments.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse border-slate-100 bg-slate-50 lg:border-r" />)
            : segments.map((s) => {
              const active = isActiveSegment(s.patch);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setFilter(s.patch)}
                  className={`border-b border-r border-slate-100 px-4 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${active ? "bg-emerald-50" : "hover:bg-slate-50"
                    }`}
                >
                  <p className={`text-2xl font-semibold tabular-nums ${active ? "text-emerald-800" : "text-slate-900"}`}>
                    {s.value.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
                </button>
              );
            })}
        </div>

        {/* filters */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder="Search name, phone, email or business"
            className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
          <div className="flex flex-wrap gap-2">
            <select aria-label="Role" className={select} value={filters.role} onChange={(e) => setFilter({ role: e.target.value })}>
              {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select aria-label="Verification" className={select} value={filters.verification} onChange={(e) => setFilter({ verification: e.target.value })}>
              {VERIFY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select aria-label="Status" className={select} value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select aria-label="Sort" className={select} value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })}>
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="hidden px-4 py-3 md:table-cell">Roles</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Location</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Status</th>
                  <th className="hidden px-4 py-3 xl:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && data.users.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading users…</td></tr>
                )}
                {error && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-red-600">{error}</td></tr>
                )}
                {!loading && !error && data.users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <p className="font-medium text-slate-800">No users match these filters</p>
                      <button type="button" onClick={() => setFilter(DEFAULT_FILTERS)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                        Clear filters
                      </button>
                    </td>
                  </tr>
                )}
                {data.users.map((u) => (
                  <tr
                    key={u._id}
                    onClick={() => setOpenId(u._id)}
                    className={`cursor-pointer hover:bg-slate-50 ${loading ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(u._id);
                            }}
                            className="block max-w-[14rem] truncate text-left font-medium text-slate-900 hover:underline focus:outline-none focus-visible:underline"
                          >
                            {fullName(u)}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {u.seller?.businessName || u.email || u.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell"><RolePills roles={u.roles} /></td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{place(u.location)}</td>
                    <td className="px-4 py-3"><VerifyBadge status={u.verification?.status} /></td>
                    <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge blocked={u.blocked?.isBlocked} /></td>
                    <td className="hidden px-4 py-3 text-slate-600 xl:table-cell">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <UserActions user={u} onAction={(user, type) => setPending({ user, type })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span className="tabular-nums">
              {data.total.toLocaleString()} {data.total === 1 ? "user" : "users"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md px-3 py-1.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tabular-nums">Page {page} of {data.pages}</span>
              <button
                type="button"
                disabled={page >= data.pages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md px-3 py-1.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {openId && (
        <UserDrawer
          id={openId}
          refreshKey={refreshKey}
          onClose={() => setOpenId(null)}
          onAction={(user, type) => setPending({ user, type })}
        />
      )}

      {pending && (
        <ConfirmModal key={`${pending.user._id}-${pending.type}`} pending={pending} onClose={() => setPending(null)} onConfirm={runAction} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
