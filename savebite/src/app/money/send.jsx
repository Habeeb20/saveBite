import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountField, Btn, Field, Row, ScreenHeader, Sheet, SuccessView, cardShadow, inputClass, usePinGate, wait } from "../../components/fin";
import { formatNaira } from "../../lib/mockData";
import { useWalletSummary } from "../../lib/useWallet";
import { walletApi } from "../../lib/wallet";

// Paylony bank codes of the banks people use most (shown first in the picker)
const POPULAR = ["000014", "000013", "000015", "000004", "000016", "100004", "100033", "090267", "090405", "000017", "000001", "000007", "000018", "000003", "000012", "000008"];
const MIN_AMOUNT = 100;

export default function Send() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const withdraw = mode === "withdraw";
  const wallet = useWalletSummary();
  const { gate, pinUI } = usePinGate();

  const [banks, setBanks] = useState([]);
  const [bank, setBank] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [vError, setVError] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [done, setDone] = useState(null);

  const balance = wallet.data?.balance ?? 0;
  const value = Number(amount) || 0;

  useEffect(() => { walletApi.banks().then((r) => setBanks(r.banks ?? [])).catch(() => {}); }, []);

  // look up the account holder as soon as bank + 10 digits are there
  useEffect(() => {
    setName(""); setVError("");
    if (!bank || acct.length !== 10) return;
    let live = true;
    setVerifying(true);
    walletApi.verifyAccount(bank.code, acct)
      .then((r) => live && setName(r.account_name))
      .catch((e) => live && setVError(e?.message || "We couldn't verify this account"))
      .finally(() => live && setVerifying(false));
    return () => { live = false; };
  }, [bank, acct]);

  const popular = useMemo(() => POPULAR.map((c) => banks.find((b) => b.code === c)).filter(Boolean), [banks]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks;
  }, [banks, search]);

  const amountError = value && value < MIN_AMOUNT ? `The minimum is ${formatNaira(MIN_AMOUNT)}` : value > balance ? "That's more than your available balance" : "";
  const ready = !!bank && !!name && value >= MIN_AMOUNT && value <= balance && !verifying;

  const confirm = async () => {
    setReviewOpen(false);
    await wait(350); // let the sheet close before the PIN pad opens
    try {
      const r = await gate(
        (pin) => walletApi.transfer({
          pin, account_number: acct, bank_code: bank.code, account_name: name,
          amount: value, narration: narration.trim() || "Transfer from SaveBite",
        }),
        { subtitle: `Send ${formatNaira(value)} to ${name}` }
      );
      if (r.cancelled) return setReviewOpen(true);
      setDone({ pending: r.result?.status === "pending", reference: r.result?.reference });
      wallet.reload();
    } catch (e) {
      Alert.alert("Transfer failed", e?.message || "Please try again.");
    }
  };

  if (done) {
    const rows = [
      { label: "To", value: name },
      { label: "Bank", value: bank.name },
      { label: "Account", value: acct },
      ...(done.reference ? [{ label: "Reference", value: done.reference }] : []),
    ];
    return (
      <SuccessView
        tone={done.pending ? "pending" : "success"}
        title={done.pending ? "Transfer processing" : "Transfer successful"}
        amount={formatNaira(value)}
        message={done.pending ? "Your bank hasn't confirmed yet. We'll update your wallet history as soon as it does. Don't send it again." : undefined}
        rows={rows}
        onPrimary={() => router.back()}
        secondary="View history"
        onSecondary={() => router.replace("/money/history")}
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title={withdraw ? "Withdraw to bank" : "Send money"} subtitle={`Available ${formatNaira(balance)}`} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Field label="Bank">
            <Pressable onPress={() => setPickOpen(true)} className="flex-row items-center rounded-2xl bg-white px-4 py-3.5">
              <Text numberOfLines={1} className={`flex-1 text-base ${bank ? "font-semibold text-gray-900" : "text-gray-400"}`}>{bank ? bank.name : "Choose a bank"}</Text>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </Pressable>
          </Field>

          <Field label="Account number" error={vError}>
            <TextInput value={acct} onChangeText={(t) => setAcct(t.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" placeholder="10-digit account number" placeholderTextColor="#9CA3AF" maxLength={10} className={inputClass} />
            {verifying ? (
              <View className="mt-2 flex-row items-center"><ActivityIndicator size="small" color="#F97316" /><Text className="ml-2 text-xs text-gray-500">Checking account...</Text></View>
            ) : name ? (
              <View className="mt-2 flex-row items-center rounded-xl bg-money-tint px-3 py-2">
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text numberOfLines={1} className="ml-2 flex-1 text-sm font-bold text-gray-900">{name}</Text>
              </View>
            ) : null}
          </Field>

          <Field label="Amount" error={amountError}>
            <AmountField value={amount} onChange={setAmount} />
            <Pressable onPress={() => setAmount(String(Math.floor(balance)))} className="mt-2 self-end"><Text className="text-xs font-bold text-brand">Use all available</Text></Pressable>
          </Field>

          <Field label="Narration" hint="Optional">
            <TextInput value={narration} onChangeText={setNarration} maxLength={60} placeholder="e.g. Foodstuff money" placeholderTextColor="#9CA3AF" className={inputClass} />
          </Field>

          <View className="mt-8"><Btn label="Review" disabled={!ready} onPress={() => setReviewOpen(true)} /></View>
          <Text className="mt-3 text-center text-xs text-gray-400">Money you've locked in savings can't be sent from here.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* review */}
      <Sheet visible={reviewOpen} onClose={() => setReviewOpen(false)} title="Confirm transfer">
        <View className="rounded-2xl bg-cream px-4 py-2">
          <Row label="Amount" value={formatNaira(value)} bold />
          <Row label="To" value={name} />
          <Row label="Bank" value={bank?.name} />
          <Row label="Account" value={acct} />
          {narration.trim() ? <Row label="Narration" value={narration.trim()} /> : null}
          <Row label="Balance after" value={formatNaira(balance - value)} />
        </View>
        <View className="mt-4"><Btn label="Confirm with PIN" icon="lock-closed" onPress={confirm} /></View>
      </Sheet>

      {/* bank picker */}
      <Modal visible={pickOpen} animationType="slide" onRequestClose={() => setPickOpen(false)}>
        <SafeAreaView className="flex-1 bg-cream">
          <View className="flex-row items-center px-4 pb-2 pt-2">
            <Text className="flex-1 pl-2 text-xl font-extrabold text-gray-900">Select bank</Text>
            <Pressable onPress={() => setPickOpen(false)} className="h-10 w-10 items-center justify-center"><Ionicons name="close" size={24} color="#111827" /></Pressable>
          </View>
          <View className="mx-4 mb-2 flex-row items-center rounded-2xl bg-white px-4" style={{ height: 48 }}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search banks" placeholderTextColor="#9CA3AF" autoCorrect={false} className="ml-2 flex-1 text-base text-gray-900" />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(b, i) => `${b.code}-${i}`}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListHeaderComponent={
              !search && popular.length ? (
                <View className="mb-2">
                  <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-500">Popular</Text>
                  <View className="flex-row flex-wrap">
                    {popular.map((b) => (
                      <Pressable key={b.code} onPress={() => { setBank(b); setPickOpen(false); }} className="mb-2 mr-2 rounded-full bg-white px-3 py-2">
                        <Text className="text-xs font-semibold text-gray-800">{b.name.replace(/ (PLC|BANK|BANK PLC)$/i, "")}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="mb-1 mt-3 px-1 text-xs font-bold uppercase tracking-wider text-gray-500">All banks</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => { setBank(item); setPickOpen(false); }} className="flex-row items-center border-b border-gray-100 py-3.5 active:opacity-60">
                <Text className="flex-1 text-sm text-gray-900">{item.name}</Text>
                {bank?.code === item.code ? <Ionicons name="checkmark" size={18} color="#F97316" /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text className="py-10 text-center text-sm text-gray-500">{banks.length ? "No bank matches your search" : "Loading banks..."}</Text>}
          />
        </SafeAreaView>
      </Modal>

      {pinUI}
    </SafeAreaView>
  );
}
