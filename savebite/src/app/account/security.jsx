import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import {
  PIN_LENGTH, biometricSupported, getLockConfig, onLockChange, removeLock, setBiometric, setPin,
} from "../../lib/appLock";

const digits = (t) => t.replace(/\D/g, "").slice(0, PIN_LENGTH);
const inputClass = "mb-3 rounded-2xl bg-white px-4 py-3.5 text-center text-xl tracking-widest text-gray-900";

export default function Security() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = String(user?._id ?? user?.id ?? "");

  const [cfg, setCfg] = useState({ hasPin: false, biometric: false });
  const [bioOk, setBioOk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setCfg(await getLockConfig(userId));
    setBioOk(await biometricSupported());
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onLockChange(load), [load]);

  const save = async () => {
    if (pin.length !== PIN_LENGTH) return Alert.alert("PIN too short", `Use exactly ${PIN_LENGTH} digits.`);
    if (pin !== confirm) return Alert.alert("PINs don't match", "Type the same PIN twice.");
    if (/^(\d)\1+$/.test(pin) || pin === "123456" || pin === "654321") return Alert.alert("Too easy to guess", "Pick a PIN that isn't a repeat or a simple sequence.");
    await setPin(userId, pin);
    setPinValue(""); setConfirm(""); setEditing(false);
    Alert.alert("PIN set", "SaveBite will ask for it when you open the app, even without internet.");
  };

  const turnOff = () =>
    Alert.alert("Turn off app lock?", "Anyone who opens your phone will be able to open SaveBite.", [
      { text: "Cancel", style: "cancel" },
      { text: "Turn off", style: "destructive", onPress: () => removeLock(userId) },
    ]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">PIN & security</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <View className="mt-4 rounded-3xl bg-white p-4">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-tint">
              <Ionicons name="keypad-outline" size={20} color="#F97316" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-gray-900">App lock PIN</Text>
              <Text className="text-xs text-gray-500">
                {cfg.hasPin ? "On. Asked when you open the app and after 30 seconds away." : "Off"}
              </Text>
            </View>
          </View>

          {editing ? (
            <View className="mt-4">
              <TextInput value={pin} onChangeText={(t) => setPinValue(digits(t))} placeholder={`New ${PIN_LENGTH}-digit PIN`} placeholderTextColor="#9CA3AF" keyboardType="number-pad" secureTextEntry maxLength={PIN_LENGTH} className={inputClass} />
              <TextInput value={confirm} onChangeText={(t) => setConfirm(digits(t))} placeholder="Confirm PIN" placeholderTextColor="#9CA3AF" keyboardType="number-pad" secureTextEntry maxLength={PIN_LENGTH} className={inputClass} />
              <View className="flex-row">
                <Pressable onPress={() => { setEditing(false); setPinValue(""); setConfirm(""); }} className="mr-2 flex-1 items-center rounded-full border border-gray-300 py-3">
                  <Text className="text-sm font-bold text-gray-700">Cancel</Text>
                </Pressable>
                <Pressable onPress={save} className="ml-2 flex-1 items-center rounded-full bg-brand py-3">
                  <Text className="text-sm font-bold text-white">Save PIN</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="mt-4 flex-row">
              <Pressable onPress={() => setEditing(true)} className="mr-2 flex-1 items-center rounded-full bg-brand py-3">
                <Text className="text-sm font-bold text-white">{cfg.hasPin ? "Change PIN" : "Set a PIN"}</Text>
              </Pressable>
              {cfg.hasPin ? (
                <Pressable onPress={turnOff} className="ml-2 flex-1 items-center rounded-full bg-red-50 py-3">
                  <Text className="text-sm font-bold text-red-600">Turn off</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View className="mt-4 flex-row items-center rounded-3xl bg-white p-4">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-tint">
            <Ionicons name="finger-print-outline" size={20} color="#F97316" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">Fingerprint / Face ID</Text>
            <Text className="text-xs text-gray-500">
              {!bioOk ? "Not set up on this phone" : !cfg.hasPin ? "Set a PIN first" : "Unlock without typing your PIN"}
            </Text>
          </View>
          <Switch
            value={cfg.biometric}
            disabled={!bioOk || !cfg.hasPin}
            onValueChange={(v) => setBiometric(userId, v)}
            trackColor={{ false: "#E5E7EB", true: "#FDBA74" }}
            thumbColor={cfg.biometric ? "#F97316" : "#FFFFFF"}
          />
        </View>

        <Text className="mt-5 px-1 text-xs leading-5 text-gray-500">
          Your PIN stays on this phone only (stored as a scrambled hash), so unlocking works with no internet.
          Forgot it? You'll log in again with your password, which needs a connection.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
