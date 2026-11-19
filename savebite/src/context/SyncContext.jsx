import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { setCacheNamespace } from "../lib/cache";
import { useOnline } from "../lib/network";
import { flush, pendingCount, setOutboxNamespace, subscribe } from "../lib/outbox";

const Ctx = createContext({ online: true, pending: 0, refreshTick: 0 });
export const useSync = () => useContext(Ctx);

// Keeps the phone and the server in step:
//  - sends queued changes when the network returns / app opens / every 30s
//  - bumps `refreshTick` so screens re-fetch fresh data after reconnecting or syncing
export function SyncProvider({ children }) {
  const { user } = useAuth();
  const userId = String(user?._id ?? user?.id ?? "");
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const wasOnline = useRef(true);

  useEffect(() => {
    setCacheNamespace(userId);
    setOutboxNamespace(userId);
    pendingCount().then(setPending);
  }, [userId]);

  useEffect(
    () =>
      subscribe(async (e) => {
        setPending(await pendingCount());
        if (e.type === "synced") setRefreshTick((t) => t + 1);
        if (e.type === "failed" && !e.silent) {
          Alert.alert("A change couldn't be saved", e.error?.message || "The server rejected it.");
        }
      }),
    []
  );

  useEffect(() => {
    if (online && userId) {
      if (!wasOnline.current) setRefreshTick((t) => t + 1);
      flush();
    }
    wasOnline.current = online;
  }, [online, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active" && userId) flush(); });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (!pending || !online) return;
    const t = setInterval(() => flush(), 30000);
    return () => clearInterval(t);
  }, [pending, online]);

  const value = useMemo(() => ({ online, pending, refreshTick }), [online, pending, refreshTick]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
