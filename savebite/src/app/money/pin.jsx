import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Btn, Field, ScreenHeader } from "../../components/fin";
import { walletApi } from "../../lib/wallet";

const box = "rounded-2xl bg-white px-4 py-4 text-center text-2xl tracking-[12px] text-gray-900";
const digits = (t) => t.replace(/\D/g, "").slice(0, 4);

// Create or change the 4-digit transaction PIN
export default function TxPin() {
  const router = useRouter();
  const [hasPin, setHasPin] = useState(null);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { walletApi.pinStatus().then((r) => setHasPin(!!r.hasPin)).catch(() => setHasPin(false)); }, []);

  const save = async () => {
    if (hasPin && current.length !== 4) return Alert.alert("Current PIN", "Enter your current 4-digit PIN.");
    if (pin.length !== 4) return Alert.alert("PIN too short", "Your PIN must be exactly 4 digits.");
    if (pin !== confirm) return Alert.alert("PINs don't match", "Type the same PIN twice.");
    setBusy(true);
    try {
      await walletApi.setPin(pin, hasPin ? current : undefined);
      Alert.alert("PIN saved", "You'll use it to send money, pay bills and move savings.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Couldn't save PIN", e?.message || "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <ScreenHeader title={hasPin ? "Change PIN" : "Create transaction PIN"} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View className="mt-2 rounded-2xl bg-white p-4">
          <Text className="text-sm text-gray-600">This 4-digit PIN protects your money. It's asked every time you send money, pay a bill or move savings. Never share it with anyone.</Text>
        </View>
        {hasPin ? <Field label="Current PIN"><TextInput value={current} onChangeText={(t) => setCurrent(digits(t))} keyboardType="number-pad" secureTextEntry maxLength={4} className={box} /></Field> : null}
        <Field label={hasPin ? "New PIN" : "Choose a PIN"} hint="Avoid easy ones like 1234 or 0000">
          <TextInput value={pin} onChangeText={(t) => setPin(digits(t))} keyboardType="number-pad" secureTextEntry maxLength={4} className={box} />
        </Field>
        <Field label="Confirm PIN"><TextInput value={confirm} onChangeText={(t) => setConfirm(digits(t))} keyboardType="number-pad" secureTextEntry maxLength={4} className={box} /></Field>
        <View className="mt-8"><Btn label="Save PIN" loading={busy} disabled={hasPin === null} onPress={save} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}
