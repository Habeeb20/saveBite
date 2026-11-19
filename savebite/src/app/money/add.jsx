import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Btn, ScreenHeader, cardShadow } from "../../components/fin";
import { useWalletSummary } from "../../lib/useWallet";

const STEPS = [
  "Open your bank app and choose Transfer.",
  "Send to the account number below.",
  "Your wallet is credited automatically, usually within a minute.",
];

export default function AddMoney() {
  const { data, loading, reload } = useWalletSummary();
  const [copied, setCopied] = useState(false);
  const [pulling, setPulling] = useState(false);
  const a = data?.account;



  const copy = async () => {
  if (!a?.number) return;
  await Clipboard.setStringAsync(a.number);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
const share = () =>
  a && Share.share({ message: `Send money to my SaveBite wallet:\n${a.bank}\n${a.number}\n${a.name}` });
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title="Add money" subtitle="Fund your wallet by bank transfer" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await reload(); setPulling(false); }} tintColor="#F97316" />}
      >
        {a ? (
          <View className="mt-4 rounded-3xl bg-white p-5" style={cardShadow}>
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Bank</Text>
            <Text className="mb-4 mt-0.5 text-lg font-bold text-gray-900">{a.bank}</Text>
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account number</Text>
            <View className="mb-4 mt-0.5 flex-row items-center">
              <Text selectable className="flex-1 text-3xl font-extrabold tracking-widest text-brand">{a.number}</Text>
              <Pressable onPress={copy} className="rounded-full bg-brand-tint px-4 py-2 active:opacity-70">
                <Text className="text-sm font-bold text-brand">{copied ? "Copied" : "Copy"}</Text>
              </Pressable>
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account name</Text>
            <Text className="mt-0.5 text-base font-bold text-gray-900">{a.name}</Text>
            <View className="mt-5"><Btn label="Share account details" icon="share-outline" variant="ghost" onPress={share} /></View>
          </View>
        ) : (
          <View className="mt-4 items-center rounded-3xl bg-white p-8" style={cardShadow}>
            <Text style={{ fontSize: 40 }}>🏦</Text>
            <Text className="mt-3 text-base font-bold text-gray-900">{loading ? "Loading your account..." : "Your account is being set up"}</Text>
            {!loading ? <Text className="mt-1 text-center text-sm text-gray-500">Your dedicated account number will show here once wallet funding is switched on. Pull down to refresh.</Text> : null}
          </View>
        )}

        <Text className="mb-2 mt-7 text-lg font-extrabold text-gray-900">How it works</Text>
        {STEPS.map((s, i) => (
          <View key={s} className="mb-2 flex-row items-center rounded-2xl bg-white p-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-tint"><Text className="font-extrabold text-brand">{i + 1}</Text></View>
            <Text className="ml-3 flex-1 text-sm text-gray-700">{s}</Text>
          </View>
        ))}
        <View className="mt-3 flex-row rounded-2xl bg-amber-50 p-3">
          <Ionicons name="information-circle-outline" size={18} color="#D97706" />
          <Text className="ml-2 flex-1 text-xs text-amber-800">A small provider fee may be taken from each transfer, so the amount credited can be slightly less than what you sent.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
