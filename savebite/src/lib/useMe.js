import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";

/**
 * Loads the full profile from /auth/me (wallet balance, virtual account, etc.).
 * The auth context only keeps a slim copy of the user, so screens that need
 * the wallet use this. It reloads every time the screen comes into focus.
 */
export function useMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api("/auth/me", { auth: true });
      setMe(res.user);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { me, loading, refreshing, error, refresh };
}