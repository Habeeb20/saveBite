import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { usePushTaps } from "../lib/usePushNotifications";

const Ctx = createContext({
  socket: null,
  isOnline: () => false,
  watch: () => {},
  unread: { notifications: 0, chat: 0 },
  setUnread: () => {},
  refreshUnread: () => {},
});
export const useSocket = () => useContext(Ctx);

export function SocketProvider({ children }) {
  // NOTE: assumes useAuth() exposes the JWT as `token`. Rename if yours differs.
  const { token, user } = useAuth();
  const myId = String(user?._id ?? user?.id ?? "");

  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState({});
  const [unread, setUnread] = useState({ notifications: 0, chat: 0 });
  const watched = useRef(new Set());
  const socketRef = useRef(null);

  usePushTaps();

  const refreshUnread = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([
        api("/notifications/unread-count", { auth: true }),
        api("/chat/unread-count", { auth: true }),
      ]);
      setUnread({ notifications: n.count ?? 0, chat: c.count ?? 0 });
    } catch {}
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      watched.current.clear();
      setSocket(null);
      setOnline({});
      setUnread({ notifications: 0, chat: 0 });
      return;
    }
    const s = connectSocket(token);
    socketRef.current = s;

    const rewatch = () => {
      if (watched.current.size) s.emit("presence:watch", [...watched.current], (res) => res && setOnline((m) => ({ ...m, ...res })));
    };
    const onPresence = ({ userId, online: o }) => setOnline((m) => ({ ...m, [userId]: o }));
    const onNotif = () => setUnread((u) => ({ ...u, notifications: u.notifications + 1 }));
    const onMsg = (m) => { if (m.sender !== myId) setUnread((u) => ({ ...u, chat: u.chat + 1 })); };

    s.on("connect", rewatch);
    s.on("presence:update", onPresence);
    s.on("notification:new", onNotif);
    s.on("message:new", onMsg);
    setSocket(s);
    refreshUnread();

    return () => {
      s.off("connect", rewatch);
      s.off("presence:update", onPresence);
      s.off("notification:new", onNotif);
      s.off("message:new", onMsg);
    };
  }, [token, myId, refreshUnread]);

  // subscribe to online/offline changes for these user ids (only asks the server about new ones)
  const watch = useCallback((ids) => {
    const fresh = [...new Set((ids || []).filter(Boolean).map(String))].filter((i) => !watched.current.has(i));
    if (!fresh.length) return;
    fresh.forEach((i) => watched.current.add(i));
    socketRef.current?.emit("presence:watch", fresh, (res) => res && setOnline((m) => ({ ...m, ...res })));
  }, []);

  const value = useMemo(
    () => ({ socket, isOnline: (id) => !!online[String(id)], watch, unread, setUnread, refreshUnread }),
    [socket, online, watch, unread, refreshUnread]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
