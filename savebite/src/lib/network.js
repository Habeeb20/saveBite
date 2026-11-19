import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { ApiError } from "./api";

// true while the phone has a working internet connection
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    return unsubscribe;
  }, []);
  return online;
}

export const checkOnline = async () => {
  const s = await NetInfo.fetch();
  return !!s.isConnected && s.isInternetReachable !== false;
};

export const statusOf = (e) => e?.status ?? e?.statusCode ?? e?.response?.status ?? null;

// "couldn't reach the server" (as opposed to the server answering with an error)
export const isNetworkError = (e) => !(e instanceof ApiError) || !statusOf(e);
