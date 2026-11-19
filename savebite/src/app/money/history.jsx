import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ReceiptSheet from "../../components/ReceiptSheet";
import { Chip, ScreenHeader } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { groupByDay, shortDate, txMeta } from "../../lib/txView";
import { walletApi } from "../../lib/wallet";

const FILTERS = [
  { id: "all", label: "All" }, { id: "in", label: "Money in" }, { id: "out", label: "Money out" },
  { id: "bills", label: "Bills" }, { id: "transfer", label: "Transfers" }, { id: "savings", label: "Savings" },
];

export default function History() {
  const [kind, setKind] = useState("all");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await walletApi.transactions(1, kind);
      setItems(r.transactions ?? []); setPage(1); setHasMore(!!r.hasMore);
    } catch (e) { setError(e?.message || "Couldn't load your activity"); }
    finally { setLoading(false); setPulling(false); }
  }, [kind]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const loadMore = async () => {
    if (!hasMore || more) return;
    setMore(true);
    try {
      const r = await walletApi.transactions(page + 1, kind);
      setItems((l) => [...l, ...(r.transactions ?? [])]); setPage(page + 1); setHasMore(!!r.hasMore);
    } catch {} finally { setMore(false); }
  };

  const rows = useMemo(() => groupByDay(items), [items]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScreenHeader title="Activity" subtitle="Everything that moved in your wallet" />
      <View className="px-6 pt-1">
        <FlatList horizontal data={FILTERS} keyExtractor={(f) => f.id} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Chip label={item.label} on={kind === item.id} onPress={() => setKind(item.id)} />} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => { setPulling(true); load(); }} tintColor="#F97316" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={more ? <ActivityIndicator color="#F97316" style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          loading ? <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} /> : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>{error ? "📡" : "🧾"}</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">{error ? "Couldn't load activity" : "Nothing here yet"}</Text>
              {error ? <Text className="mt-1 text-center text-sm text-gray-500">{error}</Text> : null}
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.type === "h") return <Text className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">{item.label}</Text>;
          const tx = item.tx; const m = txMeta(tx); const failed = tx.status === "failed";
          return (
            <Pressable onPress={() => setReceipt(tx)} className="mb-2 flex-row items-center rounded-2xl bg-white p-3 active:opacity-70">
              <View style={{ backgroundColor: m.tint }} className="h-11 w-11 items-center justify-center rounded-full"><Ionicons name={m.icon} size={20} color={m.color} /></View>
              <View className="ml-3 flex-1">
                <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">{m.title}</Text>
                <Text numberOfLines={1} className="text-xs text-gray-500">{shortDate(tx.timestamp)}{m.sub ? ` · ${m.sub}` : ""}{tx.status && tx.status !== "success" ? ` · ${tx.status}` : ""}</Text>
              </View>
              <Text className={`text-sm font-extrabold ${failed ? "text-gray-400 line-through" : m.credit ? "text-money" : "text-gray-900"}`}>{m.credit ? "+" : "-"}{formatNaira(tx.amount)}</Text>
            </Pressable>
          );
        }}
      />
      <ReceiptSheet tx={receipt} onClose={() => setReceipt(null)} />
    </SafeAreaView>
  );
}
