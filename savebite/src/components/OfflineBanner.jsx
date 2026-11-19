import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSync } from "../context/SyncContext";

// Pill above the tab bar: "Offline", "N changes waiting", "Syncing", then "Back online" for a moment.
export default function OfflineBanner() {
  const { online, pending } = useSync();
  const insets = useSafeAreaInsets();
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) { wasOffline.current = true; setBackOnline(false); return; }
    if (wasOffline.current) {
      wasOffline.current = false;
      setBackOnline(true);
      const t = setTimeout(() => setBackOnline(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (online && !backOnline && !pending) return null;

  const waiting = pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : "";
  const text = !online ? `You're offline${waiting}` : pending ? `Syncing ${pending} change${pending === 1 ? "" : "s"}...` : "Back online";
  const color = !online ? "bg-gray-900" : pending ? "bg-brand" : "bg-green-600";
  const icon = !online ? "cloud-offline-outline" : pending ? "sync" : "wifi";

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 84, alignItems: "center", zIndex: 50 }}
    >
      <View className={`flex-row items-center rounded-full px-4 py-2 ${color}`}>
        <Ionicons name={icon} size={14} color="#fff" />
        <Text className="ml-2 text-xs font-bold text-white">{text}</Text>
      </View>
    </View>
  );
}
