import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";

// Loads the seller's product stats. Reloads every time the dashboard regains focus,
// so a product you just created shows up when you come back.
export function useSellerSummary(enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setData(await api("/products/mine/summary", { auth: true }));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { data, loading, error, refresh: load };
}