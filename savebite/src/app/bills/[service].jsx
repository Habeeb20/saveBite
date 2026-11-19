import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountField, Btn, Chip, Field, Row, ScreenHeader, Segment, Sheet, SuccessView, cardShadow, inputClass, usePinGate, wait } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { useWalletSummary } from "../../lib/useWallet";
import { normPlan, walletApi } from "../../lib/wallet";

const NETWORKS = [
  { key: "mtn", label: "MTN", bg: "#FACC15", ink: "#111827" },
  { key: "airtel", label: "Airtel", bg: "#EF4444", ink: "#FFFFFF" },
  { key: "glo", label: "Glo", bg: "#22C55E", ink: "#FFFFFF" },
  { key: "9mobile", label: "9mobile", bg: "#15803D", ink: "#FFFFFF" },
];
const TV = [
  { key: "dstv", label: "DStv", bg: "#2563EB", ink: "#FFFFFF" },
  { key: "gotv", label: "GOtv", bg: "#16A34A", ink: "#FFFFFF" },
  { key: "startimes", label: "Startimes", bg: "#F97316", ink: "#FFFFFF" },
  { key: "showmax", label: "Showmax", bg: "#DC2626", ink: "#FFFFFF" },
];
// used until your electricity plan file supplies the list
const DISCOS = [
  { key: "ikeja-electric", label: "Ikeja Electric" }, { key: "eko-electric", label: "Eko Electric" },
  { key: "abuja-electric", label: "Abuja Electric" }, { key: "kano-electric", label: "Kano Electric" },
  { key: "enugu-electric", label: "Enugu Electric" }, { key: "portharcourt-electric", label: "Port Harcourt Electric" },
  { key: "ibadan-electric", label: "Ibadan Electric" }, { key: "kaduna-electric", label: "Kaduna Electric" },
  { key: "jos-electric", label: "Jos Electric" }, { key: "benin-electric", label: "Benin Electric" },
];

const SERVICES = {
  airtime: { title: "Buy airtime", providers: NETWORKS, numberLabel: "Phone number", len: 11, minAmount: 50, presets: [100, 200, 500, 1000, 2000, 5000] },
  data: { title: "Buy data", providers: NETWORKS, numberLabel: "Phone number", len: 11, plans: true },
  tv: { title: "TV subscription", providers: TV, numberLabel: "Smartcard / IUC number", len: 10, plans: true, verify: true },
  electricity: { title: "Pay electricity", providers: DISCOS, numberLabel: "Meter number", len: 11, verify: true, minAmount: 500, presets: [1000, 2000, 5000, 10000, 20000] },
};
const DONE_TITLE = { airtime: "Airtime sent", data: "Data purchased", tv: "Subscription successful", electricity: "Payment successful" };

function ProviderPill({ p, on, onPress }) {
  return (
    <Pressable onPress={onPress} className="mr-3 items-center" style={{ width: 66 }}>
      <View style={{ backgroundColor: p.bg ?? "#FFEDD5", borderWidth: on ? 3 : 0, borderColor: "#F97316" }} className="h-14 w-14 items-center justify-center rounded-full">
        <Text style={{ color: p.ink ?? "#F97316" }} className="text-base font-extrabold">{p.label.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} className={`mt-1 text-xs font-semibold ${on ? "text-brand" : "text-gray-600"}`}>{p.label}</Text>
    </Pressable>
  );
}

export default function Bill() {
  const router = useRouter();
  const { service } = useLocalSearchParams();
  const key = String(service);
  const cfg = SERVICES[key];
  const wallet = useWalletSummary();
  const { gate, pinUI } = usePinGate();

  const [discos, setDiscos] = useState(DISCOS);
  const providers = key === "electricity" ? discos : cfg?.providers ?? [];
  const [provider, setProvider] = useState(providers[0]);
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [validating, setValidating] = useState(false);
  const [vError, setVError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(null);

  const balance = wallet.data?.balance ?? 0;

  // electricity companies from your plan file (falls back to the built-in list)
  useEffect(() => {
    if (key !== "electricity") return;
    walletApi.plans("electricity").then((r) => {
      const list = (r.plans ?? []).filter((p) => p.coded && p.name).map((p) => ({ key: p.coded, label: p.name }));
      if (list.length) { setDiscos(list); setProvider(list[0]); }
    }).catch(() => {});
  }, [key]);

  // data / TV plans for the chosen network or provider
  useEffect(() => {
    if (!cfg?.plans || !provider) return;
    let live = true;
    setPlans([]); setPlan(null); setPlansError(""); setPlansLoading(true);
    walletApi.plans(provider.key)
      .then((r) => {
        if (!live) return;
        const list = (r.plans ?? []).map((p) => normPlan(p, key)).filter((p) => Number.isFinite(p.price) && p.price > 0);
        setPlans(list);
        setCategory(list[0]?.category ?? "");
      })
      .catch((e) => live && setPlansError(e?.message || "Couldn't load plans"))
      .finally(() => live && setPlansLoading(false));
    return () => { live = false; };
  }, [provider?.key, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // check who owns the smartcard / meter before taking any money
  useEffect(() => {
    setCustomer(null); setVError("");
    if (!cfg?.verify || !provider || number.length < cfg.len) return;
    let live = true;
    const t = setTimeout(async () => {
      setValidating(true);
      try {
        const r = await walletApi.validateBill({ service: key === "tv" ? "tv" : "electricity", provider: provider.key, number });
        if (live) setCustomer({ name: r.name || "Number verified" });
      } catch (e) {
        if (live) setVError(e?.message || "We couldn't verify this number");
      } finally { if (live) setValidating(false); }
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [number, provider?.key, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => [...new Set(plans.map((p) => p.category))], [plans]);
  const visible = useMemo(() => plans.filter((p) => p.category === category), [plans, category]);

  if (!cfg) {
    return (
      <SafeAreaView className="flex-1 bg-cream"><ScreenHeader title="Bills" /><Text className="mt-20 text-center text-gray-500">This service isn't available.</Text></SafeAreaView>
    );
  }

  const total = cfg.plans ? plan?.price ?? 0 : Number(amount) || 0;
  const phoneOk = cfg.verify ? number.length >= cfg.len : /^0\d{10}$/.test(number);
  const insufficient = total > balance;
  const amountError = !cfg.plans && total && total < (cfg.minAmount || 0) ? `The minimum is ${formatNaira(cfg.minAmount)}` : "";
  const ready = phoneOk && (!cfg.verify || !!customer) && total > 0 && !amountError && !insufficient && (!cfg.plans || !!plan);
  const what = cfg.plans ? plan?.name : formatNaira(total);

  const pay = async () => {
    if (cfg.plans && !plan?.coded) return Alert.alert("Plan unavailable", "This plan can't be bought right now. Pick another one.");
    setConfirmOpen(false);
    await wait(350);
    const run = (pin) =>
      key === "airtime" ? walletApi.buyAirtime({ pin, network: provider.key, amount: total, phone: number, country: "NG" })
      : key === "data" ? walletApi.buyData({ pin, coded: plan.coded, number, reseller_price: plan.price })
      : key === "tv" ? walletApi.buyTv({ pin, coded: plan.coded, number, price: plan.price })
      : walletApi.buyElectricity({ pin, number, amount: total, provider: provider.key, meterType });
    try {
      const r = await gate(run, { subtitle: `Pay ${formatNaira(total)} · ${provider.label}` });
      if (r.cancelled) return setConfirmOpen(true);
      setDone({ reference: r.result?.reference, message: r.result?.message });
      wallet.reload();
    } catch (e) {
      Alert.alert("Payment failed", e?.message || "Please try again.");
    }
  };

  if (done) {
    return (
      <SuccessView
        title={DONE_TITLE[key]}
        amount={formatNaira(total)}
        message={key === "electricity" ? "Your token will be sent to you by SMS and shown in your activity." : undefined}
        rows={[
          { label: cfg.title.replace(/^(Buy|Pay) /, ""), value: provider.label },
          ...(cfg.plans ? [{ label: "Plan", value: plan.name }] : []),
          { label: cfg.numberLabel, value: number },
          ...(customer?.name ? [{ label: "Name", value: customer.name }] : []),
          ...(done.reference ? [{ label: "Reference", value: done.reference }] : []),
        ]}
        onPrimary={() => router.back()}
        secondary="Buy again"
        onSecondary={() => { setDone(null); setPlan(null); setAmount(""); setNumber(""); }}
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title={cfg.title} subtitle={`Wallet ${formatNaira(balance)}`} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text className="mb-3 mt-2 text-sm font-bold text-gray-800">{key === "electricity" ? "Electricity company" : key === "tv" ? "Provider" : "Network"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {providers.map((p) => <ProviderPill key={p.key} p={p} on={provider?.key === p.key} onPress={() => setProvider(p)} />)}
          </ScrollView>

          {key === "electricity" ? (
            <Field label="Meter type"><Segment value={meterType} onChange={setMeterType} options={[{ id: "prepaid", label: "Prepaid" }, { id: "postpaid", label: "Postpaid" }]} /></Field>
          ) : null}

          <Field label={cfg.numberLabel} error={vError}>
            <TextInput value={number} onChangeText={(t) => setNumber(t.replace(/\D/g, "").slice(0, 13))} keyboardType="number-pad" placeholder={cfg.verify ? "Enter number" : "08012345678"} placeholderTextColor="#9CA3AF" className={inputClass} />
            {validating ? (
              <View className="mt-2 flex-row items-center"><ActivityIndicator size="small" color="#F97316" /><Text className="ml-2 text-xs text-gray-500">Verifying...</Text></View>
            ) : customer ? (
              <View className="mt-2 flex-row items-center rounded-xl bg-money-tint px-3 py-2">
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text numberOfLines={1} className="ml-2 flex-1 text-sm font-bold text-gray-900">{customer.name}</Text>
              </View>
            ) : null}
          </Field>

          {cfg.plans ? (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold text-gray-800">{key === "tv" ? "Choose a package" : "Choose a data plan"}</Text>
              {plansLoading ? (
                <ActivityIndicator color="#F97316" style={{ marginVertical: 24 }} />
              ) : plansError ? (
                <Text className="py-6 text-center text-sm text-gray-500">{plansError}</Text>
              ) : !plans.length ? (
                <Text className="py-6 text-center text-sm text-gray-500">No plans are available for {provider?.label} right now.</Text>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                    {categories.map((c) => <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />)}
                  </ScrollView>
                  {visible.map((p) => {
                    const on = plan?.key === p.key;
                    return (
                      <Pressable key={p.key} onPress={() => setPlan(p)} className={`mb-2 flex-row items-center rounded-2xl border-2 bg-white p-4 ${on ? "border-brand" : "border-transparent"}`}>
                        <View className="flex-1">
                          <Text numberOfLines={2} className="text-sm font-bold text-gray-900">{p.name}</Text>
                          {p.validity ? <Text className="mt-0.5 text-xs text-gray-500">{p.validity}</Text> : null}
                        </View>
                        <Text className="ml-3 text-base font-extrabold text-gray-900">{formatNaira(p.price)}</Text>
                        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? "#F97316" : "#D1D5DB"} style={{ marginLeft: 10 }} />
                      </Pressable>
                    );
                  })}
                </>
              )}
            </View>
          ) : (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold text-gray-800">Amount</Text>
              <View className="mb-3 flex-row flex-wrap">
                {cfg.presets.map((a) => <Chip key={a} label={formatNaira(a)} on={Number(amount) === a} onPress={() => setAmount(String(a))} />)}
              </View>
              <AmountField value={amount} onChange={setAmount} />
              {amountError ? <Text className="mt-1 text-xs text-red-600">{amountError}</Text> : null}
            </View>
          )}

          {insufficient ? (
            <View className="mt-5 flex-row items-center rounded-2xl bg-red-50 p-3">
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text className="ml-2 flex-1 text-xs text-red-700">Your wallet balance is too low for this.</Text>
              <Pressable onPress={() => router.push("/money/add")}><Text className="text-xs font-extrabold text-brand">Add money</Text></Pressable>
            </View>
          ) : null}

          <View className="mt-8"><Btn label={total ? `Pay ${formatNaira(total)}` : "Continue"} disabled={!ready} onPress={() => setConfirmOpen(true)} /></View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm payment">
        <View className="rounded-2xl bg-cream px-4 py-2">
          <Row label="Amount" value={formatNaira(total)} bold />
          <Row label={key === "electricity" ? "Company" : "Provider"} value={provider?.label} />
          {cfg.plans ? <Row label="Plan" value={plan?.name} /> : null}
          <Row label={cfg.numberLabel} value={number} />
          {customer?.name ? <Row label="Name" value={customer.name} /> : null}
          {key === "electricity" ? <Row label="Meter" value={meterType === "prepaid" ? "Prepaid" : "Postpaid"} /> : null}
          <Row label="Fee" value="₦0" />
          <Row label="Wallet after" value={formatNaira(balance - total)} />
        </View>
        <View className="mt-4"><Btn label="Pay with PIN" icon="lock-closed" onPress={pay} /></View>
      </Sheet>
      {pinUI}
    </SafeAreaView>
  );
}
