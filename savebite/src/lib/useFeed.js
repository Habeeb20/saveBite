import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { timeAgo } from "./time";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

export const mapPost = (p) => ({ ...p, time: timeAgo(p.createdAt) });

export function useFeed(filter) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const myId = String(user?._id ?? user?.id ?? "");

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const fetchPage = useCallback(async (after) => {
    let qs = "limit=15";
    if (filter !== "all") qs += `&type=${filter}`;
    if (after) qs += `&cursor=${encodeURIComponent(after)}`;
    const r = await api(`/posts?${qs}`, { auth: true });
    return { posts: (r.posts ?? []).map(mapPost), next: r.nextCursor };
  }, [filter]);

  const reload = useCallback(async (pull = false) => {
    const id = ++reqId.current;
    pull ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { posts, next } = await fetchPage(null);
      if (id !== reqId.current) return;
      setItems(posts);
      setCursor(next);
      setNewCount(0);
    } catch (e) {
      if (id === reqId.current) setError(e?.message || "Couldn't load posts");
    } finally {
      if (id === reqId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [fetchPage]);

  useEffect(() => { reload(); }, [reload]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const { posts, next } = await fetchPage(cursor);
      setItems((prev) => [...prev, ...posts.filter((p) => !prev.some((x) => x.feedId === p.feedId))]);
      setCursor(next);
    } catch {} finally { setLoadingMore(false); }
  }, [cursor, loadingMore, loading, fetchPage]);

  // live updates
  useEffect(() => {
    if (!socket) return;
    const onCounts = ({ postId, likes, comments, reposts, shares }) =>
      setItems((l) => l.map((p) => (p._id === postId ? { ...p, likes, comments, reposts, shares } : p)));
    const onDeleted = ({ postId }) => setItems((l) => l.filter((p) => p._id !== postId));
    const onNew = (p) => {
      if (p.authorId === myId) reload(true); // my own post: show it straight away
      else if (filter === "all" || p.type === filter) setNewCount((c) => c + 1); // others: "N new posts" pill
    };
    const onUpdated = () => reload(true);
    socket.on("post:counts", onCounts);
    socket.on("post:deleted", onDeleted);
    socket.on("post:new", onNew);
    socket.on("post:updated", onUpdated);
    return () => {
      socket.off("post:counts", onCounts);
      socket.off("post:deleted", onDeleted);
      socket.off("post:new", onNew);
      socket.off("post:updated", onUpdated);
    };
  }, [socket, filter, myId, reload]);

  return { items, setItems, loading, refreshing, loadingMore, error, newCount, reload, loadMore };
}
