import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { cachedApi } from "../../lib/cache";

const LABELS = ["Home", "Work", "Other"];
const inputClass = "mb-3 rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";
const EMPTY = { label: "Home", line1: "", lga: "", state: "", phone: "" };

export default function Addresses() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cachedApi("/users/me/addresses", { auth: true }).then((r) => setList(r.addresses ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    if (form.line1.trim().length < 5) return Alert.alert("Address too short", "Enter the full street address.");
    setSaving(true);
    try {
      const r = await api("/users/me/addresses", { method: "POST", auth: true, body: form });
      setList(r.addresses);
      setForm(EMPTY);
      setAdding(false);
    } catch (e) { Alert.alert("Couldn't save", e.message || "Please try again."); }
    finally { setSaving(false); }
  };

  const makeDefault = async (a) => {
    try { const r = await api(`/users/me/addresses/${a._id}`, { method: "PATCH", auth: true, body: { isDefault: true } }); setList(r.addresses); }
    catch (e) { Alert.alert("Couldn't update", e.message); }
  };

  const remove = (a) =>
    Alert.alert("Delete address?", a.line1, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { const r = await api(`/users/me/addresses/${a._id}`, { method: "DELETE", auth: true }); setList(r.addresses); }
          catch (e) { Alert.alert("Couldn't delete", e.message); }
        },
      },
    ]);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 flex-1 text-xl font-extrabold text-gray-900">Addresses</Text>
        {!adding ? (
          <Pressable onPress={() => setAdding(true)} className="flex-row items-center rounded-full bg-brand px-4 py-2">
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="ml-1 text-sm font-bold text-white">Add</Text>
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}>
          {adding ? (
            <View className="mb-5 rounded-3xl bg-gray-50 p-4">
              <View className="mb-3 flex-row">
                {LABELS.map((l) => (
                  <Pressable key={l} onPress={() => set("label")(l)} className={`mr-2 rounded-full px-4 py-2 ${form.label === l ? "bg-brand" : "bg-white"}`}>
                    <Text className={`text-sm font-semibold ${form.label === l ? "text-white" : "text-gray-700"}`}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={form.line1} onChangeText={set("line1")} placeholder="Street address" placeholderTextColor="#9CA3AF" className={inputClass} />
              <TextInput value={form.lga} onChangeText={set("lga")} placeholder="Area / LGA (e.g. Yaba)" placeholderTextColor="#9CA3AF" className={inputClass} />
              <TextInput value={form.state} onChangeText={set("state")} placeholder="State (e.g. Lagos)" placeholderTextColor="#9CA3AF" className={inputClass} />
              <TextInput value={form.phone} onChangeText={set("phone")} placeholder="Phone for delivery (optional)" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" className={inputClass} />
              <View className="flex-row">
                <Pressable onPress={() => { setAdding(false); setForm(EMPTY); }} className="mr-2 flex-1 items-center rounded-full border border-gray-300 py-3">
                  <Text className="text-sm font-bold text-gray-700">Cancel</Text>
                </Pressable>
                <Pressable onPress={add} disabled={saving} className="ml-2 flex-1 flex-row items-center justify-center rounded-full bg-brand py-3">
                  {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Save address</Text>}
                </Pressable>
              </View>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 40 }} />
          ) : !list.length && !adding ? (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>📍</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No saved addresses</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Add where you want your orders delivered.</Text>
            </View>
          ) : (
            list.map((a) => (
              <View key={a._id} className="mb-3 rounded-3xl bg-white p-4">
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-tint">
                    <Ionicons name={a.label === "Work" ? "briefcase-outline" : a.label === "Home" ? "home-outline" : "location-outline"} size={20} color="#F97316" />
                  </View>
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-base font-bold text-gray-900">{a.label}</Text>
                      {a.isDefault ? (
                        <View className="ml-2 rounded-full bg-money-tint px-2 py-0.5"><Text className="text-xs font-semibold text-green-700">Default</Text></View>
                      ) : null}
                    </View>
                    <Text className="text-sm text-gray-600">{[a.line1, a.lga, a.state].filter(Boolean).join(", ")}</Text>
                    {a.phone ? <Text className="text-xs text-gray-400">{a.phone}</Text> : null}
                  </View>
                </View>
                <View className="mt-3 flex-row border-t border-gray-100 pt-3">
                  {!a.isDefault ? (
                    <Pressable onPress={() => makeDefault(a)} className="mr-4"><Text className="text-sm font-bold text-brand">Make default</Text></Pressable>
                  ) : null}
                  <Pressable onPress={() => remove(a)}><Text className="text-sm font-bold text-red-600">Delete</Text></Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
