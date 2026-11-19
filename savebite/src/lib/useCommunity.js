import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { timeAgo } from "./time";
import { useSocket } from "../context/SocketContext";

// Latest community posts for the home screen.
// Updates live when anyone posts, edits or deletes a post.
export function useCommunity(limit = 3) {
  const { socket } = useSocket();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await api(`/posts?limit=${limit}`, { auth: true });
      setPosts((r.posts ?? []).map((p) => ({ ...p, time: timeAgo(p.createdAt) })));
    } catch {
      // keep whatever we already have
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!socket) return;
    socket.on("post:new", reload);
    socket.on("post:deleted", reload);
    socket.on("post:updated", reload);
    return () => {
      socket.off("post:new", reload);
      socket.off("post:deleted", reload);
      socket.off("post:updated", reload);
    };
  }, [socket, reload]);

  return { posts, loading, reload };
}