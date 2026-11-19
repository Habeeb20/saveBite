import { useState } from "react";

// Adjust these to match your backend's login route and field names.
const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const LOGIN_PATH = "/auth/login";
const buildBody = (identifier, password) => ({ identifier, password });

export default function Login({ onSuccess }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${API}${LOGIN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(identifier.trim(), password)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed. Check your details and try again.");

      // Only admins get in. If the response has no roles, fail closed.
      if (!data.user?.roles?.includes("admin")) {
        throw new Error("This account doesn't have admin access.");
      }

      const token = data.accessToken || data.token || data.tokens?.accessToken;
      if (!token) throw new Error("Login worked but no token came back. Check the response shape in Login.jsx.");

      localStorage.setItem("admin_token", token);
      const refresh = data.refreshToken || data.tokens?.refreshToken;
      if (refresh) localStorage.setItem("admin_refresh_token", refresh);
      localStorage.setItem("adminUser", JSON.stringify({ firstName: data.user.firstName, lastName: data.user.lastName }));

      onSuccess();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your admin account to manage users.</p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email or phone number</span>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={input}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 mt-1 flex items-center px-3 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !identifier || !password}
            className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
