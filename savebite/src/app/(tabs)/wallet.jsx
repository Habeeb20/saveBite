import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import WalletCard from "../../components/WalletCard";
import ReceiptSheet from "../../components/ReceiptSheet";
import { cardShadow } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { freqLabel, longDate, shortDate, txMeta } from "../../lib/txView";
import { useSavings, useWalletSummary } from "../../lib/useWallet";

// Bill payments: each tile opens its own screen
const BILLS = [
  { id: "data", icon: "wifi-outline", label: "Buy data", color: "#2563EB", tint: "#DBEAFE" },
  { id: "airtime", icon: "call-outline", label: "Airtime", color: "#16A34A", tint: "#DCFCE7" },
  { id: "tv", icon: "tv-outline", label: "TV", color: "#9333EA", tint: "#F3E8FF" },
  { id: "electricity", icon: "flash-outline", label: "Electricity", color: "#F59E0B", tint: "#FEF3C7" },
];

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center active:opacity-70">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white" style={cardShadow}>
        <Ionicons name={icon} size={24} color="#F97316" />
      </View>
      <Text className="mt-2 text-xs font-semibold text-gray-700">{label}</Text>
    </Pressable>
  );
}

function BillTile({ bill, onPress }) {
  return (
    <Pressable onPress={onPress} className="w-1/4 items-center active:opacity-70">
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: bill.tint }}>
        <Ionicons name={bill.icon} size={24} color={bill.color} />
      </View>
      <Text numberOfLines={1} className="mt-2 text-xs font-semibold text-gray-700">{bill.label}</Text>
    </Pressable>
  );
}

function GoalCard({ plan, onPress }) {
  const pct = plan.progress != null ? Math.round(plan.progress * 100) : null;
  return (
    <Pressable onPress={onPress} className="mb-3 rounded-3xl bg-white p-4 active:opacity-80" style={cardShadow}>
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-money-tint">
          <Text style={{ fontSize: 24 }}>{plan.emoji}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-base font-bold text-gray-900">{plan.title}</Text>
          <Text className="text-xs text-gray-500">{freqLabel(plan)}</Text>
        </View>
        {pct != null ? (
          <View className="rounded-full bg-money-tint px-2.5 py-1"><Text className="text-xs font-extrabold text-money">{pct}%</Text></View>
        ) : (
          <View className={`rounded-full px-2.5 py-1 ${plan.matured ? "bg-money-tint" : "bg-gray-100"}`}>
            <Text className={`text-xs font-extrabold ${plan.matured ? "text-money" : "text-gray-500"}`}>{plan.matured ? "Ready" : "Locked"}</Text>
          </View>
        )}
      </View>
      <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100">
        <View style={{ width: `${pct ?? (plan.balance > 0 ? 100 : 0)}%` }} className="h-full rounded-full bg-money" />
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs font-semibold text-gray-900">{formatNaira(plan.balance)} saved</Text>
        <Text className="text-xs text-gray-500">
          {plan.targetAmount ? `of ${formatNaira(plan.targetAmount)}` : plan.matured ? "Matured" : `Unlocks ${longDate(plan.maturityDate)}`}
        </Text>
      </View>
    </Pressable>
  );
}

function TxRow({ tx, onPress }) {
  const m = txMeta(tx);
  const failed = tx.status === "failed";
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-3 active:opacity-70">
      <View style={{ backgroundColor: m.tint }} className="h-11 w-11 items-center justify-center rounded-full">
        <Ionicons name={m.icon} size={20} color={m.color} />
      </View>
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">{m.title}</Text>
        <Text numberOfLines={1} className="text-xs text-gray-500">
          {shortDate(tx.timestamp)}
          {m.sub ? ` · ${m.sub}` : ""}
          {tx.status && tx.status !== "success" ? ` · ${tx.status}` : ""}
        </Text>
      </View>
      <Text className={`text-sm font-extrabold ${failed ? "text-gray-400 line-through" : m.credit ? "text-money" : "text-gray-900"}`}>
        {m.credit ? "+" : "-"}{formatNaira(tx.amount)}
      </Text>
    </Pressable>
  );
}

export default function Wallet() {
  const router = useRouter();
  const wallet = useWalletSummary();
  const savings = useSavings();
  const [receipt, setReceipt] = useState(null);
  const [pulling, setPulling] = useState(false);

  const w = wallet.data;
  const plans = savings.plans.filter((p) => p.status === "active");
  const onRefresh = async () => { setPulling(true); await Promise.allSettled([wallet.reload(), savings.reload()]); setPulling(false); };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">Wallet</Text>
            <Text className="text-sm text-gray-500">Your money, savings and payments</Text>
          </View>
          <Pressable onPress={() => router.push("/notifications")} className="h-11 w-11 items-center justify-center rounded-full bg-white active:opacity-70">
            <Ionicons name="notifications-outline" size={22} color="#111827" />
          </Pressable>
        </View>

        <View className="mx-6">
          <WalletCard balance={w?.balance ?? 0} loading={wallet.loading} />
        </View>

        {/* money you can't spend: locked in savings */}
        <Pressable onPress={() => router.push("/savings")} className="mx-6 mt-3 flex-row items-center rounded-2xl bg-money-tint px-4 py-3 active:opacity-80">
          <Ionicons name="lock-closed" size={16} color="#16A34A" />
          <Text className="ml-2 flex-1 text-xs font-semibold text-gray-700">Locked in savings</Text>
          <Text className="text-sm font-extrabold text-money">{formatNaira(w?.locked ?? 0)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#16A34A" style={{ marginLeft: 4 }} />
        </Pressable>

        {w && !w.hasPin ? (
          <Pressable onPress={() => router.push("/money/pin")} className="mx-6 mt-3 flex-row items-center rounded-2xl bg-amber-50 px-4 py-3 active:opacity-80">
            <Ionicons name="shield-outline" size={18} color="#D97706" />
            <Text className="ml-2 flex-1 text-xs font-semibold text-amber-800">Set a transaction PIN to send money and pay bills</Text>
            <Text className="text-xs font-extrabold text-brand">Set up</Text>
          </Pressable>
        ) : null}

        {wallet.error && !w ? (
          <Pressable onPress={wallet.reload} className="mx-6 mt-3 rounded-2xl bg-white p-4">
            <Text className="text-sm text-gray-600">{wallet.error}. Tap to try again.</Text>
          </Pressable>
        ) : null}

        <View className="mx-6 mt-5 flex-row">
          <QuickAction icon="add-circle-outline" label="Add money" onPress={() => router.push("/money/add")} />
          <QuickAction icon="arrow-up-circle-outline" label="Withdraw" onPress={() => router.push({ pathname: "/money/send", params: { mode: "withdraw" } })} />
          <QuickAction icon="swap-horizontal-outline" label="Send" onPress={() => router.push("/money/send")} />
          <QuickAction icon="flag-outline" label="New goal" onPress={() => router.push("/savings/create")} />
        </View>

        {/* bill payments */}
        <View className="mb-3 mt-8 px-6">
          <Text className="text-xl font-extrabold text-gray-900">Pay bills</Text>
          <Text className="text-xs text-gray-500">Data, airtime, TV and light in a few taps</Text>
        </View>
        <View className="mx-6 flex-row rounded-3xl bg-white px-2 py-4">
          {BILLS.map((b) => <BillTile key={b.id} bill={b} onPress={() => router.push(`/bills/${b.id}`)} />)}
        </View>

        {/* ajo */}
        <View className="mb-3 mt-8 flex-row items-end justify-between px-6">
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-gray-900">Food savings (Ajo)</Text>
            <Text className="text-xs text-gray-500">Lock money away for your next food-stuff</Text>
          </View>
          <Pressable onPress={() => router.push("/savings")} hitSlop={8}>
            <Text className="text-sm font-semibold text-brand">See all</Text>
          </Pressable>
        </View>

        <View className="mx-6 mb-3 flex-row items-center rounded-2xl bg-money-tint px-4 py-3">
          <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
          <Text className="ml-2 flex-1 text-xs font-semibold text-gray-700">Total saved so far</Text>
          <Text className="text-base font-extrabold text-money">{formatNaira(savings.summary.totalSaved)}</Text>
        </View>

        <View className="px-6">
          {savings.loading ? (
            <ActivityIndicator color="#F97316" style={{ marginVertical: 16 }} />
          ) : plans.length ? (
            plans.slice(0, 3).map((p) => <GoalCard key={p._id} plan={p} onPress={() => router.push(`/savings/${p._id}`)} />)
          ) : (
            <Pressable onPress={() => router.push("/savings/create")} className="items-center rounded-3xl bg-white px-6 py-8 active:opacity-80" style={cardShadow}>
              <Text style={{ fontSize: 38 }}>🌽</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">Start your first savings plan</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Set money aside for Christmas, school fees or monthly provisions.</Text>
              <View className="mt-4 rounded-full bg-brand px-5 py-2.5"><Text className="text-sm font-bold text-white">Create a plan</Text></View>
            </Pressable>
          )}
        </View>

        {/* transactions */}
        <View className="mb-1 mt-6 flex-row items-center justify-between px-6">
          <Text className="text-xl font-extrabold text-gray-900">Recent activity</Text>
          <Pressable onPress={() => router.push("/money/history")} className="active:opacity-70">
            <Text className="text-sm font-semibold text-brand">See all</Text>
          </Pressable>
        </View>
        <View className="mx-6 rounded-3xl bg-white px-4 py-2">
          {w?.recent?.length ? (
            w.recent.map((t, i) => (
              <View key={t._id || `${t.reference}-${i}`} className={i ? "border-t border-gray-100" : ""}>
                <TxRow tx={t} onPress={() => setReceipt(t)} />
              </View>
            ))
          ) : (
            <View className="items-center py-10">
              <Text style={{ fontSize: 40 }}>🧾</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No transactions yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Add money to your wallet and it will show up here.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <ReceiptSheet tx={receipt} onClose={() => setReceipt(null)} />
    </SafeAreaView>
  );
}