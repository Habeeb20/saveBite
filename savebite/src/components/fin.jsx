import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export const cardShadow = { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
export const inputClass = "rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";
export const fmtDigits = (s) => String(s ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function ScreenHeader({ title, subtitle, right }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center px-4 pb-2 pt-2">
      <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
        <Ionicons name="chevron-back" size={24} color="#111827" />
      </Pressable>
      <View className="ml-1 flex-1">
        <Text className="text-xl font-extrabold text-gray-900">{title}</Text>
        {subtitle ? <Text className="text-xs text-gray-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Btn({ label, onPress, loading, disabled, variant = "primary", icon }) {
  const off = disabled || loading;
  const box = variant === "primary" ? (off ? "bg-brand/50" : "bg-brand") : variant === "danger" ? "bg-red-50" : "border border-gray-300 bg-white";
  const ink = variant === "primary" ? "text-white" : variant === "danger" ? "text-red-600" : "text-gray-800";
  return (
    <Pressable onPress={off ? undefined : onPress} className={`flex-row items-center justify-center rounded-2xl py-4 ${box}`}>
      {loading ? <ActivityIndicator color={variant === "primary" ? "#fff" : "#F97316"} /> : icon ? <Ionicons name={icon} size={18} color={variant === "primary" ? "#fff" : "#374151"} /> : null}
      <Text className={`${loading || icon ? "ml-2" : ""} text-base font-extrabold ${ink}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <View className="mt-5">
      {label ? <Text className="mb-1.5 text-sm font-bold text-gray-800">{label}</Text> : null}
      {children}
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : hint ? <Text className="mt-1 text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} className={`mb-2 mr-2 rounded-full px-4 py-2 ${on ? "bg-brand" : "bg-white"}`}>
      <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-700"}`}>{label}</Text>
    </Pressable>
  );
}

export function Segment({ options, value, onChange }) {
  return (
    <View className="flex-row rounded-2xl bg-gray-100 p-1">
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} className={`flex-1 items-center rounded-xl py-2.5 ${value === o.id ? "bg-white" : ""}`}>
          <Text className={`text-sm font-semibold ${value === o.id ? "text-brand" : "text-gray-500"}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ label, value, bold, color }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text numberOfLines={2} className={`ml-4 flex-1 text-right text-sm ${bold ? "font-extrabold" : "font-semibold"} ${color || "text-gray-900"}`}>{value}</Text>
    </View>
  );
}

export function AmountField({ value, onChange, placeholder = "0" }) {
  return (
    <View className="items-center rounded-3xl bg-white py-6" style={cardShadow}>
      <View className="flex-row items-center">
        <Text className="text-3xl font-extrabold text-gray-300">₦</Text>
        <TextInput
          value={fmtDigits(value)}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, 9))}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor="#D1D5DB"
          className="ml-1 min-w-[80px] text-center text-4xl font-extrabold text-gray-900"
        />
      </View>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable className="rounded-t-3xl bg-white px-6 pb-8 pt-3" onPress={() => {}}>
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-gray-200" />
            {title ? <Text className="mb-3 text-xl font-extrabold text-gray-900">{title}</Text> : null}
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------ transaction PIN ------------------------------ */

export function PinModal({ visible, title = "Enter your PIN", subtitle, error, attempt, onSubmit, onCancel }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPin(""); setBusy(false); }, [attempt, visible]);

  const press = (d) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) { setBusy(true); onSubmit(next); }
  };
  const Key = ({ children, onPress }) => (
    <Pressable onPress={onPress} className="m-1.5 h-16 w-16 items-center justify-center rounded-full bg-gray-100 active:opacity-60">{children}</Pressable>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <SafeAreaView edges={["bottom"]} className="items-center rounded-t-3xl bg-white px-6 pb-4 pt-5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-tint">
            <Ionicons name="lock-closed" size={22} color="#F97316" />
          </View>
          <Text className="mt-3 text-xl font-extrabold text-gray-900">{title}</Text>
          <Text className="mt-1 text-center text-sm text-gray-500">{subtitle || "Confirm with your 4-digit transaction PIN"}</Text>
          <View className="my-5 flex-row">
            {[0, 1, 2, 3].map((i) => <View key={i} className={`mx-2 h-4 w-4 rounded-full ${i < pin.length ? "bg-brand" : "bg-gray-300"}`} />)}
          </View>
          <Text className="mb-2 h-5 text-sm font-semibold text-red-600">{error || ""}</Text>
          {busy ? (
            <View className="h-72 items-center justify-center"><ActivityIndicator color="#F97316" size="large" /></View>
          ) : (
            <>
              {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].map((r) => (
                <View key={r[0]} className="flex-row">{r.map((d) => <Key key={d} onPress={() => press(d)}><Text className="text-2xl font-bold text-gray-900">{d}</Text></Key>)}</View>
              ))}
              <View className="flex-row">
                <Key onPress={onCancel}><Ionicons name="close" size={26} color="#6B7280" /></Key>
                <Key onPress={() => press("0")}><Text className="text-2xl font-bold text-gray-900">0</Text></Key>
                <Key onPress={() => setPin((p) => p.slice(0, -1))}><Ionicons name="backspace-outline" size={26} color="#374151" /></Key>
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * const { gate, pinUI } = usePinGate();   ...   render {pinUI}
 * const r = await gate((pin) => api(..., { pin }));   -> { result } | { cancelled: true }
 * Asks for the PIN, runs your request, and asks again if the PIN was wrong. Throws other errors.
 */
export function usePinGate() {
  const router = useRouter();
  const [ui, setUi] = useState(null);
  const counter = useRef(0);

  const ask = (error, subtitle) =>
    new Promise((resolve) => { counter.current += 1; setUi({ resolve, error, subtitle, attempt: counter.current }); });

  const gate = useCallback(async (run, { subtitle } = {}) => {
    let error = "";
    for (;;) {
      const pin = await ask(error, subtitle);
      if (pin === null) { setUi(null); return { cancelled: true }; }
      try {
        const result = await run(pin);
        setUi(null);
        return { result };
      } catch (e) {
        const msg = e?.message || "";
        if (/wrong pin/i.test(msg)) { error = msg; continue; }
        setUi(null);
        if (/create a transaction pin/i.test(msg)) {
          Alert.alert("Set your PIN", "Create a 4-digit transaction PIN to keep your money safe.", [
            { text: "Later", style: "cancel" },
            { text: "Create PIN", onPress: () => router.push("/money/pin") },
          ]);
          return { cancelled: true };
        }
        throw e;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinUI = (
    <PinModal visible={!!ui} error={ui?.error} subtitle={ui?.subtitle} attempt={ui?.attempt} onSubmit={(p) => ui?.resolve(p)} onCancel={() => ui?.resolve(null)} />
  );
  return { gate, pinUI };
}

/* ---------------------------------- result ---------------------------------- */

export function SuccessView({ tone = "success", title, message, amount, rows = [], primary, onPrimary, secondary, onSecondary }) {
  const pending = tone === "pending";
  return (
    <SafeAreaView className="flex-1 bg-cream px-6">
      <View className="flex-1 items-center justify-center">
        <View className={`h-24 w-24 items-center justify-center rounded-full ${pending ? "bg-amber-100" : "bg-money-tint"}`}>
          <Ionicons name={pending ? "time" : "checkmark"} size={48} color={pending ? "#D97706" : "#16A34A"} />
        </View>
        <Text className="mt-6 text-center text-2xl font-extrabold text-gray-900">{title}</Text>
        {amount ? <Text className="mt-2 text-4xl font-extrabold text-gray-900">{amount}</Text> : null}
        {message ? <Text className="mt-2 px-4 text-center text-sm text-gray-500">{message}</Text> : null}
        {rows.length ? (
          <View className="mt-6 w-full rounded-3xl bg-white px-5 py-3" style={cardShadow}>
            {rows.map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
          </View>
        ) : null}
      </View>
      <View className="pb-4">
        <Btn label={primary || "Done"} onPress={onPrimary} />
        {secondary ? <View className="mt-3"><Btn label={secondary} onPress={onSecondary} variant="ghost" /></View> : null}
      </View>
    </SafeAreaView>
  );
}
