import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { savingsApi, walletApi } from "./wallet";

// wallet overview: spendable balance, money locked in savings, bank account, recent activity
export function useWalletSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setData(await walletApi.summary()); setError(""); }
    catch (e) { setError(e?.message || "Couldn't load your wallet"); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload])); // fresh every time the screen is shown
  return { data, loading, error, reload };
}

export function useSavings() {
  const [data, setData] = useState({ plans: [], summary: { totalSaved: 0, activePlans: 0, lockedAmount: 0, readyAmount: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setData(await savingsApi.list()); setError(""); }
    catch (e) { setError(e?.message || "Couldn't load your savings"); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { ...data, loading, error, reload };
}
