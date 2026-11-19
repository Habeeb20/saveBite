import { useEffect, useState } from "react";

const ICONS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.2a3.5 3.5 0 0 1 0 6.6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  );
}

export default function AdminLayout({ items, onLogout }) {
  const [activeId, setActiveId] = useState(items[0].id);
  const [open, setOpen] = useState(false);

  const active = items.find((i) => i.id === activeId) || items[0];
  const Page = active.component;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id) => {
    setActiveId(id);
    setOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* sidebar: fixed drawer on mobile, static column on lg+ */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <span className="text-lg font-bold tracking-tight">Admin</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
          {items.map((item) => {
            const isActive = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar: hamburger on mobile, page title, sign out everywhere */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="sidebar"
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          >
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <span className="flex-1 font-semibold">{active.label}</span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Sign out
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <Page />
        </main>
      </div>
    </div>
  );
}
