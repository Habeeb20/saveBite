import { useEffect, useState } from "react";
import AdminLayout from "./layout/AdminLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const STORAGE_KEYS = ["admin_token", "admin_refresh_token", "adminUser"];
const clearSession = () => STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));

// Each sidebar item renders its imported component in the main area.
// To add a page: import it above and add one line here (icon names live in AdminLayout).
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home", component: Dashboard },
  { id: "users", label: "Users", icon: "users", component: AdminUsers },
];

export default function App() {
  // "out" -> login page, "checking" -> verifying a saved token, "in" -> dashboard
  const [status, setStatus] = useState(() => (localStorage.getItem("admin_token") ? "checking" : "out"));

  // A saved token only skips the login page if the server still accepts it for an admin.
  useEffect(() => {
    if (status !== "checking") return;
    let cancelled = false;

    fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("in");
        } else {
          clearSession();
          setStatus("out");
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setStatus("out");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const logout = () => {
    clearSession();
    setStatus("out");
  };

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Checking session…</div>;
  }
  if (status === "out") return <Login onSuccess={() => setStatus("in")} />;
  return <AdminLayout items={NAV} onLogout={logout} />;
}
