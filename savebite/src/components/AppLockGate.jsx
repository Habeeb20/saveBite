import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import {
  PIN_LENGTH, authenticateBiometric, getLockConfig, onLockChange, removeLock, verifyPin,
} from "../lib/appLock";

const LOCK_AFTER_MS = 30000; // lock again after 30s in the background
let sessionStartedThisRun = false; // true once a user was seen (or logged in) since the app process started

function LockScreen({ userId, biometric, onUnlock, onForgot }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const tryBiometric = useCallback(async () => {
    if (await authenticateBiometric()) onUnlock();
  }, [onUnlock]);

  useEffect(() => { if (biometric) tryBiometric(); }, [biometric, tryBiometric]);

  const submit = async (value) => {
    setBusy(true);
    const r = await verifyPin(userId, value);
    setBusy(false);
    if (r.ok) return onUnlock();
    setPin("");
    if (r.tooMany) return onForgot(true);
    setMsg(r.wait ? `Too many tries. Wait ${r.wait}s.` : `Wrong PIN. ${r.left} tr${r.left === 1 ? "y" : "ies"} left.`);
  };

  const press = (d) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setMsg("");
    if (next.length === PIN_LENGTH) submit(next);
  };

  const Key = ({ children, onPress }) => (
    <Pressable onPress={onPress} className="m-2 h-16 w-16 items-center justify-center rounded-full bg-white active:opacity-60">
      {children}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-cream px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
        <Ionicons name="lock-closed" size={28} color="#F97316" />
      </View>
      <Text className="mt-4 text-xl font-extrabold text-gray-900">Enter your PIN</Text>
      <Text className="mt-1 h-5 text-sm text-red-600">{msg}</Text>

      <View className="my-6 flex-row">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} className={`mx-1.5 h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-brand" : "bg-gray-300"}`} />
        ))}
      </View>

      {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].map((row) => (
        <View key={row[0]} className="flex-row">
          {row.map((d) => (
            <Key key={d} onPress={() => press(d)}><Text className="text-2xl font-bold text-gray-900">{d}</Text></Key>
          ))}
        </View>
      ))}
      <View className="flex-row">
        <Key onPress={biometric ? tryBiometric : undefined}>
          {biometric ? <Ionicons name="finger-print" size={28} color="#F97316" /> : <View />}
        </Key>
        <Key onPress={() => press("0")}><Text className="text-2xl font-bold text-gray-900">0</Text></Key>
        <Key onPress={() => setPin((p) => p.slice(0, -1))}><Ionicons name="backspace-outline" size={26} color="#374151" /></Key>
      </View>

      <Pressable onPress={() => onForgot(false)} className="mt-6">
        <Text className="text-sm font-semibold text-brand">Forgot PIN?</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// Wrap the app with this (inside AuthProvider). With a PIN set, the app asks for it when it opens
// and after 30s in the background. It all happens on the phone, so it works with no internet.
export default function AppLockGate({ children }) {
  const { user, signOut } = useAuth();
  const userId = String(user?._id ?? user?.id ?? "");
  const [cfg, setCfg] = useState(null);
  const [locked, setLocked] = useState(false);
  const cfgRef = useRef(null);
  const leftAt = useRef(0);
  const initFor = useRef(null); // the user we have already decided "locked or not" for, this launch
  const prevUser = useRef("");

  const loadCfg = useCallback(async () => {
    const c = userId ? await getLockConfig(userId) : { hasPin: false, biometric: false };
    cfgRef.current = c;
    setCfg(c);
  }, [userId]);

  useEffect(() => { loadCfg(); }, [loadCfg]);
  useEffect(() => onLockChange(loadCfg), [loadCfg]);

  // cold start with a saved session: ask for the PIN. A fresh login on this phone: no need.
  useEffect(() => {
    if (!cfg || !userId || initFor.current === userId) return;
    const coldStart = !sessionStartedThisRun;
    sessionStartedThisRun = true;
    initFor.current = userId;
    setLocked(coldStart ? cfg.hasPin : false);
  }, [cfg, userId]);

  // logging out removes the PIN of that account from the phone
  useEffect(() => {
    if (prevUser.current && !userId) removeLock(prevUser.current);
    prevUser.current = userId;
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" || s === "inactive") {
        if (!leftAt.current) leftAt.current = Date.now();
      } else if (s === "active") {
        if (cfgRef.current?.hasPin && leftAt.current && Date.now() - leftAt.current > LOCK_AFTER_MS) setLocked(true);
        leftAt.current = 0;
      }
    });
    return () => sub.remove();
  }, []);

  const forgot = (tooMany) => {
    const go = async () => { await removeLock(userId); await signOut(); };
    if (tooMany) return go();
    Alert.alert("Forgot your PIN?", "You'll log in again with your password (needs internet). Your PIN will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log in again", style: "destructive", onPress: go },
    ]);
  };

  if (cfg === null) return null;
  if (userId && cfg.hasPin && locked) {
    return <LockScreen userId={userId} biometric={cfg.biometric} onUnlock={() => setLocked(false)} onForgot={forgot} />;
  }
  return children;
}
