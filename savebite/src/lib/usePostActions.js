import { useCallback, useEffect, useState } from "react";
import { Share } from "react-native";
import { api } from "./api";

// Optimistic like / save / repost / share for any list of posts (feed, saved, ...)
export function usePostActions(setItems) {
  const patch = useCallback(
    (id, fn) => setItems((list) => list.map((p) => (p._id === id ? fn(p) : p))),
    [setItems]
  );

  const like = useCallback(async (id) => {
    const flip = (p) => ({ ...p, liked: !p.liked, likes: Math.max(0, p.likes + (p.liked ? -1 : 1)) });
    patch(id, flip);
    try {
      const r = await api(`/posts/${id}/like`, { method: "POST", auth: true });
      patch(id, (p) => ({ ...p, liked: r.liked, likes: r.likesCount }));
    } catch { patch(id, flip); }
  }, [patch]);

  const save = useCallback(async (id) => {
    const flip = (p) => ({ ...p, saved: !p.saved });
    patch(id, flip);
    try {
      const r = await api(`/posts/${id}/save`, { method: "POST", auth: true });
      patch(id, (p) => ({ ...p, saved: r.saved }));
    } catch { patch(id, flip); }
  }, [patch]);

  const repost = useCallback(async (id) => {
    const flip = (p) => ({ ...p, reposted: !p.reposted, reposts: Math.max(0, p.reposts + (p.reposted ? -1 : 1)) });
    patch(id, flip);
    try {
      const r = await api(`/posts/${id}/repost`, { method: "POST", auth: true });
      patch(id, (p) => ({ ...p, reposted: r.reposted, reposts: r.repostsCount }));
    } catch (e) { patch(id, flip); throw e; }
  }, [patch]);

  const share = useCallback(async (post) => {
    const res = await Share.share({
      message: `${post.author?.name ?? "SaveBite"}: ${post.text}${post.price ? `\n₦${Number(post.price).toLocaleString()}` : ""}\n\nSee it on SaveBite`,
    });
    if (res.action === Share.sharedAction) {
      const r = await api(`/posts/${post._id}/share`, { method: "POST", auth: true }).catch(() => null);
      if (r) patch(post._id, (p) => ({ ...p, shares: r.sharesCount }));
    }
  }, [patch]);

  return { like, save, repost, share };
}

// who I follow (a Set of user ids) + optimistic follow/unfollow
export function useFollowing() {
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    api("/follow/following", { auth: true }).then((r) => setIds(new Set(r.ids))).catch(() => {});
  }, []);

  const toggle = useCallback(async (userId) => {
    const flip = () => setIds((s) => { const n = new Set(s); n.has(userId) ? n.delete(userId) : n.add(userId); return n; });
    flip();
    try {
      const r = await api(`/follow/${userId}`, { method: "POST", auth: true });
      setIds((s) => { const n = new Set(s); r.following ? n.add(userId) : n.delete(userId); return n; });
    } catch { flip(); }
  }, []);

  return { following: ids, toggleFollow: toggle };
}
