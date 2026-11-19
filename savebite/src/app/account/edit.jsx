import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Image from "../../components/CachedImage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { checkOnline } from "../../lib/network";
import { mutate } from "../../lib/outbox";
import { uploadImage } from "../../lib/cloudinary";
import { useAuth } from "../../context/AuthContext";
import { useMe } from "../../lib/useMe";

const inputClass = "rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";

function Field({ label, hint, children }) {
  return (
    <View className="mt-5">
      <Text className="mb-1.5 text-sm font-bold text-gray-800">{label}</Text>
      {children}
      {hint ? <Text className="mt-1 text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}

export default function EditProfile() {
  const router = useRouter();
  const auth = useAuth();
  const { me, refresh } = useMe();
  const profile = { ...auth.user, ...me };
  const isSeller = profile.roles?.includes("seller");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [avatar, setAvatar] = useState(null); // newly picked asset
  const [saving, setSaving] = useState(false);

  // fill the form once the real data is available
  useEffect(() => {
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setShopName(profile.seller?.shopName ?? "");
    setArea(profile.seller?.area ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.firstName, profile.lastName, profile.seller?.shopName, profile.seller?.area]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to change your picture.");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled) setAvatar(r.assets[0]);
  };

  const save = async () => {
    if (saving) return;
    if (!firstName.trim() || !lastName.trim()) return Alert.alert("Missing name", "Enter your first and last name.");
    setSaving(true);
    try {
      const body = { firstName, lastName };
      if (avatar) {
        if (!(await checkOnline())) throw new Error("Changing your photo needs internet. Save your other changes now and change the photo later.");
        body.avatar = await uploadImage(avatar);
      }
      if (isSeller) { body.shopName = shopName; body.area = area; }
      const r = await mutate({ kind: "profile", method: "PATCH", path: "/users/me", body, dedupeKey: "profile:edit" });
      await Promise.all([refresh?.(), auth.refreshUser?.()]); // refresh whichever your app provides
      Alert.alert("Saved", r.queued ? "Saved on your phone. It will update when you're back online." : "Your profile is updated.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    } finally { setSaving(false); }
  };

  const shown = avatar?.uri ?? profile.avatar?.url ?? (typeof profile.avatar === "string" ? profile.avatar : null);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "SB";

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">Edit profile</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <View className="mt-4 items-center">
            <Pressable onPress={pickAvatar}>
              {shown ? (
                <Image source={{ uri: shown }} className="h-24 w-24 rounded-full bg-gray-200" />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-full bg-brand">
                  <Text className="text-3xl font-extrabold text-white">{initials}</Text>
                </View>
              )}
              <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-900">
                <Ionicons name="camera" size={15} color="#fff" />
              </View>
            </Pressable>
          </View>

          <Field label="First name"><TextInput value={firstName} onChangeText={setFirstName} maxLength={50} className={inputClass} /></Field>
          <Field label="Last name"><TextInput value={lastName} onChangeText={setLastName} maxLength={50} className={inputClass} /></Field>
          {isSeller ? (
            <>
              <Field label="Shop name"><TextInput value={shopName} onChangeText={setShopName} maxLength={80} placeholder="e.g. Mama Nkechi Foodstuff" placeholderTextColor="#9CA3AF" className={inputClass} /></Field>
              <Field label="Area" hint="Shown on your posts, e.g. Yaba, Lagos">
                <TextInput value={area} onChangeText={setArea} maxLength={80} className={inputClass} />
              </Field>
            </>
          ) : null}

          <Field label="Phone" hint="To change your phone number or email, contact support.">
            <View className={`${inputClass} opacity-60`}><Text className="text-base text-gray-900">{profile.phone || profile.email || "-"}</Text></View>
          </Field>

          <Pressable onPress={save} disabled={saving} className={`mt-8 flex-row items-center justify-center rounded-2xl py-4 ${saving ? "bg-brand/60" : "bg-brand"}`}>
            {saving ? <ActivityIndicator color="#fff" /> : null}
            <Text className="ml-2 text-base font-extrabold text-white">{saving ? "Saving..." : "Save changes"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
