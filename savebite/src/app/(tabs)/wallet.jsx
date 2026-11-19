

import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WalletCard from "../../components/WalletCard";
import { useMe } from "../../lib/useMe";
import { formatNaira } from "../../lib/mockData";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d) => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
};

const comingSoon = (what) => Alert.alert("Coming soon", `${what} will be added next.`);

// Preview of personal ajo goals. Replace with real data once the savings API exists.
const AJO_GOALS = [
  { id: "g1", emoji: "🎄", title: "Christmas foodstuff", saved: 62000, target: 150000, note: "₦5,000 every week" },
  { id: "g2", emoji: "🛒", title: "Monthly provisions", saved: 28000, target: 40000, note: "₦10,000 every month" },
];

// Bill payments. Wire each one to its screen/API when ready.
const BILLS = [
  { id: "data", icon: "wifi-outline", label: "Buy data", color: "#2563EB", tint: "#DBEAFE" },
  { id: "airtime", icon: "call-outline", label: "Airtime", color: "#16A34A", tint: "#DCFCE7" },
  { id: "tv", icon: "tv-outline", label: "TV", color: "#9333EA", tint: "#F3E8FF" },
  { id: "electricity", icon: "flash-outline", label: "Electricity", color: "#F59E0B", tint: "#FEF3C7" },
];

const BILL_NAMES = {
  data: "Buying data",
  airtime: "Buying airtime",
  tv: "TV subscriptions",
  electricity: "Electricity payments",
};

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center active:opacity-70">
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <Ionicons name={icon} size={24} color="#F97316" />
      </View>
      <Text className="mt-2 text-xs font-semibold text-gray-700">{label}</Text>
    </Pressable>
  );
}

function BillTile({ bill, onPress }) {
  return (
    <Pressable onPress={onPress} className="w-1/4 items-center active:opacity-70">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: bill.tint }}
      >
        <Ionicons name={bill.icon} size={24} color={bill.color} />
      </View>
      <Text numberOfLines={1} className="mt-2 text-xs font-semibold text-gray-700">
        {bill.label}
      </Text>
    </Pressable>
  );
}

function GoalCard({ goal }) {
  const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
  return (
    <View
      className="mb-3 rounded-3xl bg-white p-4"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-money-tint">
          <Text style={{ fontSize: 24 }}>{goal.emoji}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-gray-900">{goal.title}</Text>
          <Text className="text-xs text-gray-500">{goal.note}</Text>
        </View>
        <View className="rounded-full bg-money-tint px-2.5 py-1">
          <Text className="text-xs font-extrabold text-money">{pct}%</Text>
        </View>
      </View>

      <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100">
        <View style={{ width: `${pct}%` }} className="h-full rounded-full bg-money" />
      </View>

      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs font-semibold text-gray-900">{formatNaira(goal.saved)} saved</Text>
        <Text className="text-xs text-gray-500">of {formatNaira(goal.target)}</Text>
      </View>
    </View>
  );
}

function TxRow({ tx }) {
  const credit = tx.type === "credit";
  const failed = tx.status === "failed";
  return (
    <View className="flex-row items-center py-3">
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${
          credit ? "bg-money-tint" : "bg-red-50"
        }`}
      >
        <Ionicons
          name={credit ? "arrow-down" : "arrow-up"}
          size={20}
          color={credit ? "#16A34A" : "#DC2626"}
        />
      </View>
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
          {credit ? "Money in" : "Money out"}
          {tx.provider ? ` · ${tx.provider}` : ""}
        </Text>
        <Text className="text-xs text-gray-500">
          {shortDate(tx.timestamp)}
          {tx.status && tx.status !== "success" ? ` · ${tx.status}` : ""}
        </Text>
      </View>
      <Text
        className={`text-sm font-extrabold ${
          failed ? "text-gray-400 line-through" : credit ? "text-money" : "text-gray-900"
        }`}
      >
        {credit ? "+" : "-"}
        {formatNaira(tx.amount)}
      </Text>
    </View>
  );
}

export default function Wallet() {
  const { me, loading, refreshing, refresh } = useMe();
  const [addOpen, setAddOpen] = useState(false);

  const txs = useMemo(
    () =>
      [...(me?.wallet?.transactions || [])]
        .filter((t) => t.type !== "balance_check")
        .reverse()
        .slice(0, 15),
    [me]
  );

  const totalSaved = useMemo(() => AJO_GOALS.reduce((sum, g) => sum + g.saved, 0), []);

  // Dedicated bank account the user can transfer to
  const account = useMemo(() => {
    const p = me?.paylonyVirtualAccountDetails;
    const v = me?.virtualAccountDetails;
    if (p?.account_number) return { number: p.account_number, name: p.account_name, bank: p.bank_name };
    if (v?.account_number) return { number: v.account_number, name: v.account_name, bank: v.bank };
    return null;
  }, [me]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F97316" />}
      >
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">Wallet</Text>
            <Text className="text-sm text-gray-500">Your money, savings and payments</Text>
          </View>
          <Pressable
            onPress={() => comingSoon("Notifications")}
            className="h-11 w-11 items-center justify-center rounded-full bg-white active:opacity-70"
          >
            <Ionicons name="notifications-outline" size={22} color="#111827" />
          </Pressable>
        </View>

        <View className="mx-6">
          <WalletCard balance={me?.wallet?.balance ?? 0} loading={loading} />
        </View>

        <View className="mx-6 mt-5 flex-row">
          <QuickAction icon="add-circle-outline" label="Add money" onPress={() => setAddOpen(true)} />
          <QuickAction icon="arrow-up-circle-outline" label="Withdraw" onPress={() => comingSoon("Withdrawals")} />
          <QuickAction icon="swap-horizontal-outline" label="Send" onPress={() => comingSoon("Transfers")} />
          <QuickAction icon="flag-outline" label="New goal" onPress={() => comingSoon("Creating a savings goal")} />
        </View>

        {/* bill payments */}
        <View className="mb-3 mt-8 px-6">
          <Text className="text-xl font-extrabold text-gray-900">Pay bills</Text>
          <Text className="text-xs text-gray-500">Data, airtime, TV and light in a few taps</Text>
        </View>
        <View className="mx-6 flex-row rounded-3xl bg-white px-2 py-4">
          {BILLS.map((b) => (
            <BillTile key={b.id} bill={b} onPress={() => comingSoon(BILL_NAMES[b.id])} />
          ))}
        </View>

        {/* ajo */}
        <View className="mb-3 mt-8 flex-row items-end justify-between px-6">
          <View>
            <Text className="text-xl font-extrabold text-gray-900">Food savings (Ajo)</Text>
            <Text className="text-xs text-gray-500">Save a little at a time for your next food-stuff</Text>
          </View>
          <View className="rounded-full bg-gray-100 px-2.5 py-1">
            <Text className="text-xs font-semibold text-gray-500">Preview</Text>
          </View>
        </View>

        <View className="mx-6 mb-3 flex-row items-center rounded-2xl bg-money-tint px-4 py-3">
          <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
          <Text className="ml-2 flex-1 text-xs font-semibold text-gray-700">Total saved so far</Text>
          <Text className="text-base font-extrabold text-money">{formatNaira(totalSaved)}</Text>
        </View>

        <View className="px-6">
          {AJO_GOALS.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </View>

        {/* transactions */}
        <View className="mb-1 mt-6 flex-row items-center justify-between px-6">
          <Text className="text-xl font-extrabold text-gray-900">Recent activity</Text>
          <Pressable onPress={() => comingSoon("Full transaction history")} className="active:opacity-70">
            <Text className="text-sm font-semibold text-brand">See all</Text>
          </Pressable>
        </View>
        <View className="mx-6 rounded-3xl bg-white px-4 py-2">
          {txs.length ? (
            txs.map((t, i) => (
              <View key={t._id || `${t.reference}-${i}`} className={i ? "border-t border-gray-100" : ""}>
                <TxRow tx={t} />
              </View>
            ))
          ) : (
            <View className="items-center py-10">
              <Text style={{ fontSize: 40 }}>🧾</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No transactions yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">
                Add money to your wallet and it will show up here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* add money sheet */}
      <Modal transparent visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setAddOpen(false)}>
          <Pressable className="rounded-t-3xl bg-white px-6 pb-10 pt-3" onPress={() => {}}>
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-gray-200" />
            <Text className="text-xl font-extrabold text-gray-900">Add money</Text>
            <Text className="mb-5 mt-1 text-sm text-gray-500">
              Transfer from any bank app to your SaveBite account. It reflects in your wallet automatically.
            </Text>

            {account ? (
              <View className="rounded-2xl bg-cream p-4">
                <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Bank</Text>
                <Text className="mb-3 mt-0.5 text-base font-bold text-gray-900">{account.bank}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account number</Text>
                <Text selectable className="mb-3 mt-0.5 text-2xl font-extrabold tracking-widest text-brand">
                  {account.number}
                </Text>
                <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account name</Text>
                <Text className="mt-0.5 text-base font-bold text-gray-900">{account.name}</Text>
              </View>
            ) : (
              <View className="items-center rounded-2xl bg-cream p-6">
                <Text style={{ fontSize: 36 }}>🏦</Text>
                <Text className="mt-2 text-base font-bold text-gray-900">Your account is being set up</Text>
                <Text className="mt-1 text-center text-sm text-gray-500">
                  Your dedicated account number will appear here once wallet funding is switched on.
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => setAddOpen(false)}
              className="mt-6 items-center rounded-2xl bg-brand py-4 active:opacity-80"
            >
              <Text className="text-base font-bold text-white">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}