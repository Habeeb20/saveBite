import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Btn, ScreenHeader, cardShadow } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { freqLabel, longDate } from "../../lib/txView";
import { useSavings } from "../../lib/useWallet";

function PlanCard({ plan, onPress }) {
  const pct = plan.progress != null ? Math.round(plan.progress * 100) : null;
  const closed = plan.status === "closed";
  return (
    <Pressable onPress={onPress} className={`mb-3 rounded-3xl bg-white p-4 active:opacity-80 ${closed ? "opacity-60" : ""}`} style={cardShadow}>
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-money-tint"><Text style={{ fontSize: 24 }}>{plan.emoji}</Text></View>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-base font-bold text-gray-900">{plan.title}</Text>
          <Text className="text-xs text-gray-500">{freqLabel(plan)}</Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${closed ? "bg-gray-100" : plan.matured ? "bg-money-tint" : "bg-amber-50"}`}>
          <Text className={`text-xs font-extrabold ${closed ? "text-gray-500" : plan.matured ? "text-money" : "text-amber-700"}`}>
            {closed ? "Completed" : plan.matured ? "Ready" : `${plan.daysLeft}d left`}
          </Text>
        </View>
      </View>
      <Text className="mt-4 text-2xl font-extrabold text-gray-900">{formatNaira(plan.balance)}</Text>
      {pct != null ? (
        <>
          <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"><View style={{ width: `${pct}%` }} className="h-full rounded-full bg-money" /></View>
          <Text className="mt-1.5 text-xs text-gray-500">{pct}% of {formatNaira(plan.targetAmount)}</Text>
        </>
      ) : null}
      <View className="mt-3 flex-row items-center">
        <Ionicons name={plan.matured || closed ? "lock-open-outline" : "lock-closed-outline"} size={13} color="#9CA3AF" />
        <Text className="ml-1 text-xs text-gray-500">{closed ? "Closed" : plan.matured ? "Unlocked" : `Unlocks ${longDate(plan.maturityDate)}`}</Text>
      </View>
    </Pressable>
  );
}

export default function Savings() {
  const router = useRouter();
  const s = useSavings();
  const [pulling, setPulling] = useState(false);
  const active = s.plans.filter((p) => p.status === "active");
  const closed = s.plans.filter((p) => p.status === "closed");

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title="Food savings" subtitle="Lock money away, reach your goals" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await s.reload(); setPulling(false); }} tintColor="#F97316" />}
      >
        <View className="mt-2 rounded-3xl bg-brand p-5">
          <View className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15" />
          <Text className="text-xs font-bold uppercase tracking-wide text-white/80">Total saved</Text>
          <Text className="mt-1 text-4xl font-extrabold text-white">{formatNaira(s.summary.totalSaved)}</Text>
          <View className="mt-4 flex-row">
            <View className="flex-1"><Text className="text-xs text-white/80">Locked</Text><Text className="text-base font-bold text-white">{formatNaira(s.summary.lockedAmount)}</Text></View>
            <View className="flex-1"><Text className="text-xs text-white/80">Ready to withdraw</Text><Text className="text-base font-bold text-white">{formatNaira(s.summary.readyAmount)}</Text></View>
          </View>
        </View>

        <View className="mt-4 flex-row rounded-2xl bg-white p-3">
          <Ionicons name="information-circle-outline" size={18} color="#F97316" />
          <Text className="ml-2 flex-1 text-xs text-gray-600">Money in a plan is locked until your chosen date and can't be spent or transferred. Taking it out early costs a 10% fee.</Text>
        </View>

        <View className="mb-3 mt-6 flex-row items-center justify-between">
          <Text className="text-xl font-extrabold text-gray-900">Your plans</Text>
          <Pressable onPress={() => router.push("/savings/create")} className="flex-row items-center rounded-full bg-brand px-4 py-2">
            <Ionicons name="add" size={16} color="#fff" /><Text className="ml-1 text-sm font-bold text-white">New plan</Text>
          </Pressable>
        </View>

        {s.loading ? (
          <ActivityIndicator color="#F97316" style={{ marginTop: 30 }} />
        ) : s.error && !s.plans.length ? (
          <Text className="py-10 text-center text-sm text-gray-500">{s.error}</Text>
        ) : active.length ? (
          active.map((p) => <PlanCard key={p._id} plan={p} onPress={() => router.push(`/savings/${p._id}`)} />)
        ) : (
          <View className="items-center rounded-3xl bg-white px-6 py-10" style={cardShadow}>
            <Text style={{ fontSize: 44 }}>🌽</Text>
            <Text className="mt-3 text-base font-semibold text-gray-900">No savings plans yet</Text>
            <Text className="mb-5 mt-1 text-center text-sm text-gray-500">Start small. Even ₦500 a week adds up to a full Christmas basket.</Text>
            <Btn label="Create a plan" onPress={() => router.push("/savings/create")} />
          </View>
        )}

        {closed.length ? (
          <>
            <Text className="mb-3 mt-6 text-lg font-extrabold text-gray-900">Completed</Text>
            {closed.map((p) => <PlanCard key={p._id} plan={p} onPress={() => router.push(`/savings/${p._id}`)} />)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
