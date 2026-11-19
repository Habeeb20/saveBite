import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountField, Btn, Field, Row, ScreenHeader, Segment, Sheet, SuccessView, cardShadow, usePinGate, wait } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { freqLabel, longDate, shortDate } from "../../lib/txView";
import { newRef, savingsApi } from "../../lib/wallet";

const TX = {
  deposit: ["Deposit", "arrow-down", "#16A34A", 1], auto_deposit: ["Auto-save", "repeat", "#16A34A", 1],
  withdrawal: ["Withdrawal", "arrow-up", "#111827", -1], penalty: ["Early withdrawal fee", "remove-circle-outline", "#DC2626", -1],
  interest: ["Interest earned", "trending-up", "#16A34A", 1], auto_missed: ["Auto-save skipped", "alert-circle-outline", "#D97706", 0],
};
const FREQ = [{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }];

export default function PlanDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { gate, pinUI } = usePinGate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
  const [sheet, setSheet] = useState(null); // "deposit" | "withdraw" | "auto"
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState(null);
  const [freq, setFreq] = useState("weekly");
  const [autoAmt, setAutoAmt] = useState("");
  const [done, setDone] = useState(null);
  const ref = useRef(newRef());

  const load = useCallback(async () => {
    try { setPlan((await savingsApi.get(id)).plan); setError(""); }
    catch (e) { setError(e?.message || "Couldn't load this plan"); }
    finally { setLoading(false); setPulling(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const closeSheet = () => { setSheet(null); setAmount(""); setPreview(null); };

  // the fee is shown BEFORE the user confirms a withdrawal
  useEffect(() => {
    if (sheet !== "withdraw" || !plan) return;
    const n = Number(amount) || plan.balance;
    if (!(n > 0) || n > plan.balance) { setPreview(null); return; }
    let live = true;
    const t = setTimeout(() => savingsApi.preview(id, n).then((p) => live && setPreview(p)).catch(() => live && setPreview(null)), 250);
    return () => { live = false; clearTimeout(t); };
  }, [sheet, amount, plan, id]);

  const deposit = async () => {
    const n = Number(amount);
    if (!(n >= 100)) return Alert.alert("Amount too small", "The minimum is ₦100.");
    setSheet(null);
    await wait(350);
    try {
      const r = await gate((pin) => savingsApi.deposit(id, { amount: n, clientRef: ref.current, pin }), { subtitle: `Save ${formatNaira(n)} into ${plan.title}` });
      if (r.cancelled) return setSheet("deposit");
      ref.current = newRef();
      setPlan(r.result.plan); setAmount("");
    } catch (e) { Alert.alert("Couldn't save", e?.message || "Please try again."); setSheet("deposit"); }
  };

  const withdraw = async () => {
    const n = Number(amount) || plan.balance;
    setSheet(null);
    await wait(350);
    try {
      const r = await gate((pin) => savingsApi.withdraw(id, { amount: n, clientRef: ref.current, pin }), { subtitle: `Withdraw ${formatNaira(n)} to your wallet` });
      if (r.cancelled) return setSheet("withdraw");
      ref.current = newRef();
      setPlan(r.result.plan); setAmount(""); setPreview(null);
      setDone(r.result);
    } catch (e) { Alert.alert("Couldn't withdraw", e?.message || "Please try again."); setSheet("withdraw"); }
  };

  const patch = async (body) => {
    try { setPlan((await savingsApi.update(id, body)).plan); return true; }
    catch (e) { Alert.alert("Couldn't update", e?.message || "Please try again."); return false; }
  };

  if (done) {
    const closed = plan?.status === "closed";
    return (
      <SuccessView
        title={done.matured ? "Withdrawal successful" : "Early withdrawal done"}
        amount={formatNaira(done.payout)}
        message={done.matured ? "Your savings have been moved to your wallet." : `A ${Math.round(plan.penaltyRate * 100)}% fee of ${formatNaira(done.penalty)} was taken for withdrawing before ${longDate(plan.maturityDate)}.`}
        rows={[
          { label: "Added to wallet", value: formatNaira(done.payout) },
          ...(done.penalty ? [{ label: "Early withdrawal fee", value: formatNaira(done.penalty) }] : []),
          ...(done.interest ? [{ label: "Interest earned", value: formatNaira(done.interest) }] : []),
          { label: closed ? "Plan" : "Still saved", value: closed ? "Completed" : formatNaira(plan.balance) },
        ]}
        onPrimary={() => (closed ? router.replace("/savings") : setDone(null))}
      />
    );
  }

  if (loading) return <SafeAreaView className="flex-1 items-center justify-center bg-cream"><ActivityIndicator color="#F97316" /></SafeAreaView>;
  if (!plan) {
    return <SafeAreaView className="flex-1 bg-cream"><ScreenHeader title="Savings" /><Text className="mt-20 px-10 text-center text-gray-500">{error || "Plan not found"}</Text></SafeAreaView>;
  }

  const closed = plan.status === "closed";
  const pct = plan.progress != null ? Math.round(plan.progress * 100) : null;
  const pctFee = Math.round(plan.penaltyRate * 100);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title={plan.title} subtitle={closed ? "Completed" : plan.matured ? "Matured" : `Locked · ${plan.daysLeft} days left`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => { setPulling(true); load(); }} tintColor="#F97316" />}>
        <View className="mt-2 rounded-3xl bg-white p-5" style={cardShadow}>
          <View className="flex-row items-center">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-money-tint"><Text style={{ fontSize: 28 }}>{plan.emoji}</Text></View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">Saved</Text>
              <Text className="text-3xl font-extrabold text-gray-900">{formatNaira(plan.balance)}</Text>
            </View>
          </View>
          {pct != null ? (
            <>
              <View className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100"><View style={{ width: `${pct}%` }} className="h-full rounded-full bg-money" /></View>
              <View className="mt-2 flex-row justify-between"><Text className="text-xs font-semibold text-gray-900">{pct}% reached</Text><Text className="text-xs text-gray-500">Target {formatNaira(plan.targetAmount)}</Text></View>
            </>
          ) : null}
        </View>

        {!closed ? (
          plan.matured ? (
            <View className="mt-3 flex-row rounded-2xl bg-money-tint p-3">
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text className="ml-2 flex-1 text-sm text-gray-800">Your savings have matured. Withdraw them to your wallet with no fee.</Text>
            </View>
          ) : (
            <View className="mt-3 flex-row rounded-2xl bg-amber-50 p-3">
              <Ionicons name="lock-closed" size={18} color="#D97706" />
              <Text className="ml-2 flex-1 text-sm text-amber-900">Locked until {longDate(plan.maturityDate)}. Withdrawing earlier costs {pctFee}% of the amount.</Text>
            </View>
          )
        ) : null}

        {!closed ? (
          <View className="mt-4 flex-row">
            {!plan.matured ? <View className="mr-2 flex-1"><Btn label="Add money" icon="add" onPress={() => setSheet("deposit")} /></View> : null}
            <View className={plan.matured ? "flex-1" : "ml-2 flex-1"}><Btn label={plan.matured ? "Withdraw all" : "Withdraw"} icon="arrow-up" variant={plan.matured ? "primary" : "ghost"} disabled={plan.balance <= 0} onPress={() => { setAmount(plan.matured ? "" : ""); setSheet("withdraw"); }} /></View>
          </View>
        ) : null}

        <View className="mt-5 rounded-3xl bg-white px-5 py-3" style={cardShadow}>
          <Row label="Total deposited" value={formatNaira(plan.totalDeposited)} />
          <Row label="Unlocks" value={longDate(plan.maturityDate)} />
          <Row label="Saving" value={freqLabel(plan)} />
          {plan.autoEnabled && plan.nextRunAt ? <Row label="Next auto-save" value={shortDate(plan.nextRunAt)} /> : null}
          {plan.missedRuns ? <Row label="Skipped auto-saves" value={String(plan.missedRuns)} color="text-amber-700" /> : null}
        </View>

        {!closed && !plan.matured ? (
          <View className="mt-4 rounded-3xl bg-white p-4" style={cardShadow}>
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-tint"><Ionicons name="repeat" size={20} color="#F97316" /></View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900">Auto-save</Text>
                <Text className="text-xs text-gray-500">{plan.autoEnabled ? `${formatNaira(plan.autoAmount)} ${plan.frequency} from your wallet` : "Save automatically from your wallet"}</Text>
              </View>
              <Switch
                value={plan.autoEnabled}
                onValueChange={(v) => {
                  if (v && plan.frequency === "none") { setFreq("weekly"); setAutoAmt(""); return setSheet("auto"); }
                  patch({ autoEnabled: v });
                }}
                trackColor={{ false: "#E5E7EB", true: "#FDBA74" }}
                thumbColor={plan.autoEnabled ? "#F97316" : "#FFFFFF"}
              />
            </View>
            {plan.autoEnabled ? <Pressable onPress={() => { setFreq(plan.frequency); setAutoAmt(String(plan.autoAmount)); setSheet("auto"); }} className="mt-3 self-start"><Text className="text-sm font-bold text-brand">Change amount or schedule</Text></Pressable> : null}
          </View>
        ) : null}

        <Text className="mb-2 mt-7 text-xl font-extrabold text-gray-900">History</Text>
        <View className="rounded-3xl bg-white px-4 py-2">
          {plan.transactions?.length ? plan.transactions.map((t, i) => {
            const m = TX[t.type] || ["Activity", "ellipse-outline", "#6B7280", 0];
            return (
              <View key={`${t.ref}-${t.type}-${i}`} className={`flex-row items-center py-3 ${i ? "border-t border-gray-100" : ""}`}>
                <Ionicons name={m[1]} size={20} color={m[2]} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{m[0]}</Text>
                  <Text numberOfLines={1} className="text-xs text-gray-500">{shortDate(t.at)}{t.note ? ` · ${t.note}` : ""}</Text>
                </View>
                <Text className={`text-sm font-extrabold ${m[3] > 0 ? "text-money" : m[3] < 0 ? "text-gray-900" : "text-gray-400"}`}>{m[3] > 0 ? "+" : m[3] < 0 ? "-" : ""}{formatNaira(t.amount)}</Text>
              </View>
            );
          }) : <Text className="py-8 text-center text-sm text-gray-500">No activity yet. Add money to get started.</Text>}
        </View>
      </ScrollView>

      {/* add money */}
      <Sheet visible={sheet === "deposit"} onClose={closeSheet} title="Add to savings">
        <AmountField value={amount} onChange={setAmount} />
        <Text className="mt-2 text-xs text-gray-500">Taken from your wallet and locked in this plan until {longDate(plan.maturityDate)}.</Text>
        <View className="mt-4"><Btn label="Continue" disabled={!(Number(amount) >= 100)} icon="lock-closed" onPress={deposit} /></View>
      </Sheet>

      {/* withdraw: fee shown up front */}
      <Sheet visible={sheet === "withdraw"} onClose={closeSheet} title={plan.matured ? "Withdraw savings" : "Withdraw early"}>
        <AmountField value={amount} onChange={setAmount} placeholder={String(Math.floor(plan.balance))} />
        <Pressable onPress={() => setAmount(String(Math.floor(plan.balance)))} className="mt-2 self-end"><Text className="text-xs font-bold text-brand">Withdraw everything ({formatNaira(plan.balance)})</Text></Pressable>
        <View className="mt-3 rounded-2xl bg-cream px-4 py-2">
          <Row label="Withdrawing" value={formatNaira(preview?.amount ?? (Number(amount) || plan.balance))} />
          <Row label={preview?.matured === false ? `Early fee (${pctFee}%)` : "Fee"} value={preview ? formatNaira(preview.penalty) : "..."} color={preview?.penalty ? "text-red-600" : "text-money"} />
          {preview?.interest ? <Row label="Interest earned" value={`+${formatNaira(preview.interest)}`} color="text-money" /> : null}
          <Row label="You receive" value={preview ? formatNaira(preview.payout) : "..."} bold />
        </View>
        {!plan.matured ? <Text className="mt-2 text-xs text-amber-700">Wait until {longDate(plan.maturityDate)} to withdraw with no fee.</Text> : null}
        <View className="mt-4"><Btn label={plan.matured ? "Withdraw to wallet" : "Pay the fee & withdraw"} variant={plan.matured ? "primary" : "danger"} disabled={!preview} icon="lock-closed" onPress={withdraw} /></View>
      </Sheet>

      {/* auto-save settings */}
      <Sheet visible={sheet === "auto"} onClose={closeSheet} title="Auto-save">
        <Field label="How often"><Segment value={freq} onChange={setFreq} options={FREQ} /></Field>
        <Field label="Amount each time"><AmountField value={autoAmt} onChange={setAutoAmt} /></Field>
        <View className="mt-4"><Btn label="Save auto-save" disabled={!(Number(autoAmt) >= 100)} onPress={async () => { if (await patch({ frequency: freq, autoAmount: Number(autoAmt), autoEnabled: true })) closeSheet(); }} /></View>
      </Sheet>
      {pinUI}
    </SafeAreaView>
  );
}
