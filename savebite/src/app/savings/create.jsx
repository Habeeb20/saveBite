import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AmountField, Btn, Chip, Field, Row, ScreenHeader, Segment, cardShadow, fmtDigits, inputClass, usePinGate } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { longDate } from "../../lib/txView";
import { useWalletSummary } from "../../lib/useWallet";
import { newRef, savingsApi } from "../../lib/wallet";

const EMOJIS = ["🌽", "🍚", "🍲", "🥩", "🐟", "🎄", "🛒", "🏠", "🎓", "💍"];
const DURATIONS = [{ label: "1 month", days: 30 }, { label: "3 months", days: 90 }, { label: "6 months", days: 180 }, { label: "1 year", days: 365 }, { label: "2 years", days: 730 }];
const FREQ = [{ id: "none", label: "Manual" }, { id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }];

export default function CreatePlan() {
  const router = useRouter();
  const wallet = useWalletSummary();
  const { gate, pinUI } = usePinGate();
  const ref = useRef(newRef()); // same id if you tap twice or retry: you'll never get two plans

  const [cfg, setCfg] = useState({ minAmount: 100, minDays: 7, penaltyRate: 0.1 });
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🌽");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState(90);
  const [customDays, setCustomDays] = useState("");
  const [frequency, setFrequency] = useState("none");
  const [auto, setAuto] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { savingsApi.config().then(setCfg).catch(() => {}); }, []);

  const lockDays = customDays ? Number(customDays) : days;
  const unlock = useMemo(() => new Date(Date.now() + lockDays * 86400000), [lockDays]);
  const balance = wallet.data?.balance ?? 0;
  const initialN = Number(initial) || 0;
  const autoN = Number(auto) || 0;
  const pct = Math.round(cfg.penaltyRate * 100);

  const errors = {
    title: title.trim().length < 2 ? "Give your plan a name" : "",
    days: lockDays < cfg.minDays ? `Lock for at least ${cfg.minDays} days` : lockDays > 1825 ? "The longest lock is 5 years" : "",
    auto: frequency !== "none" && autoN < cfg.minAmount ? `Auto-save must be at least ${formatNaira(cfg.minAmount)}` : "",
    initial: initialN && initialN < cfg.minAmount ? `The first deposit must be at least ${formatNaira(cfg.minAmount)}` : initialN > balance ? "That's more than your wallet balance" : "",
  };
  const ok = !errors.title && !errors.days && !errors.auto && !errors.initial;

  const create = async () => {
    setBusy(true);
    const body = {
      title: title.trim(), emoji, targetAmount: Number(target) || 0, maturityDate: unlock.toISOString(),
      frequency, autoAmount: frequency === "none" ? 0 : autoN, initialDeposit: initialN, clientRef: ref.current,
    };
    try {
      const r = initialN > 0
        ? await gate((pin) => savingsApi.create({ ...body, pin }), { subtitle: `Lock ${formatNaira(initialN)} into ${body.title}` })
        : { result: await savingsApi.create(body) };
      if (r.cancelled) return;
      Alert.alert("Plan created 🎉", `Your money is locked until ${longDate(unlock)}.`);
      router.replace(`/savings/${r.result.plan._id}`);
    } catch (e) {
      Alert.alert("Couldn't create plan", e?.message || "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title="New savings plan" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <Field label="Plan name" error={title ? errors.title : ""}>
            <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. Christmas foodstuff" placeholderTextColor="#9CA3AF" className={inputClass} />
          </Field>
          <View className="mt-3 flex-row flex-wrap">{EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => setEmoji(e)} className={`mb-2 mr-2 h-12 w-12 items-center justify-center rounded-2xl ${emoji === e ? "border-2 border-brand bg-brand-tint" : "bg-white"}`}><Text style={{ fontSize: 22 }}>{e}</Text></Pressable>
          ))}</View>

          <Field label="Target amount" hint="Optional. Leave empty if you just want to lock money away.">
            <AmountField value={target} onChange={setTarget} />
          </Field>

          <Field label="Lock my money for" error={errors.days}>
            <View className="flex-row flex-wrap">{DURATIONS.map((d) => <Chip key={d.days} label={d.label} on={!customDays && days === d.days} onPress={() => { setDays(d.days); setCustomDays(""); }} />)}</View>
            <TextInput value={customDays} onChangeText={(t) => setCustomDays(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="Or type a number of days" placeholderTextColor="#9CA3AF" className={`${inputClass} mt-1`} />
            <View className="mt-2 flex-row items-center"><Ionicons name="lock-closed" size={13} color="#16A34A" /><Text className="ml-1.5 text-xs font-semibold text-gray-700">Unlocks on {longDate(unlock)}</Text></View>
          </Field>

          <Field label="How do you want to save?">
            <Segment value={frequency} onChange={setFrequency} options={FREQ} />
          </Field>
          {frequency !== "none" ? (
            <Field label={`Amount to save ${frequency}`} error={auto ? errors.auto : ""} hint="Taken from your wallet automatically. If your wallet is short, that day is skipped.">
              <AmountField value={auto} onChange={setAuto} />
            </Field>
          ) : null}

          <Field label="First deposit" error={errors.initial} hint={`Optional. Your wallet has ${formatNaira(balance)}.`}>
            <AmountField value={initial} onChange={setInitial} />
          </Field>

          <View className="mt-6 rounded-3xl bg-white p-4" style={cardShadow}>
            <Text className="mb-1 text-sm font-extrabold text-gray-900">How it works</Text>
            <Row label="Locked until" value={longDate(unlock)} />
            <Row label="Saving" value={frequency === "none" ? "Manual top-ups" : `${autoN ? formatNaira(autoN) : "₦0"} ${frequency}`} />
            <Row label="Early withdrawal fee" value={`${pct}% of what you take out`} color="text-red-600" />
            <Text className="mt-1 text-xs text-gray-500">On or after {longDate(unlock)} you withdraw everything to your wallet with no fee. Until then this money can't be spent, sent or used to pay bills.</Text>
          </View>

          <View className="mt-6"><Btn label={initialN ? `Create plan & save ${formatNaira(initialN)}` : "Create plan"} loading={busy} disabled={!ok} onPress={create} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
      {pinUI}
    </SafeAreaView>
  );
}
