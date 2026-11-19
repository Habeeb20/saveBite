import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Image from "../../components/CachedImage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ApiError } from "../../lib/api";
import { cachedApi } from "../../lib/cache";
import { mutate } from "../../lib/outbox";
import { uploadImages } from "../../lib/cloudinary";
import { useAuth } from "../../context/AuthContext";

const MAX_IMAGES = 4;
const UNITS = ["kg", "bag", "bunch", "plate", "piece", "litre", "pack"];
const inputClass = "rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";

function Field({ label, optional, error, children }) {
  return (
    <View className="mt-5">
      <View className="mb-1.5 flex-row items-center">
        <Text className="text-sm font-bold text-gray-800">{label}</Text>
        {optional ? <Text className="ml-1.5 text-xs text-gray-400">(optional)</Text> : null}
      </View>
      {children}
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

// Create a post, or edit one when opened as /posts/create?id=<postId>
export default function CreatePost() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const { user } = useAuth();
  const isSeller = user?.roles?.includes("seller");

  const TYPES = isSeller
    ? [{ id: "stock", label: "Foodstuff" }, { id: "menu", label: "Ready to eat" }, { id: "wanted", label: "Wanted" }]
    : [{ id: "wanted", label: "Wanted" }];

  const [type, setType] = useState(isSeller ? "stock" : "wanted");
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [images, setImages] = useState([]); // { uri, remote?, url?, publicId? }
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState("");
  const [loadingPost, setLoadingPost] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    cachedApi(`/posts/${id}`, { auth: true })
      .then(({ post }) => {
        setType(post.type);
        setText(post.text ?? "");
        setPrice(post.price != null ? String(post.price) : "");
        setUnit(post.unit ?? "");
        setImages((post.images ?? []).map((i) => ({ uri: i.url, url: i.url, publicId: i.publicId, remote: true })));
      })
      .catch((e) => Alert.alert("Couldn't load post", e.message, [{ text: "OK", onPress: () => router.back() }]))
      .finally(() => setLoadingPost(false));
  }, [editing, id, router]);

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to add pictures.");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.7,
    });
    if (!r.canceled) setImages((prev) => [...prev, ...r.assets].slice(0, MAX_IMAGES));
  };

  const validate = () => {
    const e = {};
    if (text.trim().length < 3) e.text = "Write at least a few words";
    if (type !== "wanted" && (price === "" || isNaN(Number(price)))) e.price = "Add a price";
    if (type === "wanted" && price !== "" && isNaN(Number(price))) e.price = "Enter a valid price";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      // new photos are uploaded when there is a connection (now, or later if you're offline)
      const fresh = images.filter((i) => !i.remote);
      const keep = images.filter((i) => i.remote).map((i) => ({ url: i.url, publicId: i.publicId }));

      setStep(editing ? "Saving..." : "Posting...");
      const body = {
        text: text.trim(),
        images: keep,
        price: price === "" ? (editing ? null : undefined) : Number(price),
        unit: unit || (editing ? "" : undefined),
      };
      const r = await mutate({
        kind: "post",
        method: editing ? "PATCH" : "POST",
        path: editing ? `/posts/${id}` : "/posts",
        body: editing ? body : { ...body, type },
        uploads: fresh.length ? [{ field: "images", assets: fresh }] : undefined,
      });
      if (r.queued) Alert.alert("Saved on your phone", "Your post will go live as soon as you're back online.");
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      Alert.alert(editing ? "Couldn't save" : "Couldn't post", e.message || "Please try again.");
    } finally { setSubmitting(false); setStep(""); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">
          {editing ? "Edit post" : type === "wanted" ? "New request" : "New post"}
        </Text>
      </View>

      {loadingPost ? (
        <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            {!editing && TYPES.length > 1 ? (
              <Field label="What are you posting?">
                <View className="flex-row flex-wrap">
                  {TYPES.map((t) => {
                    const on = type === t.id;
                    return (
                      <Pressable key={t.id} onPress={() => setType(t.id)} className={`mb-2 mr-2 rounded-full px-4 py-2 ${on ? "bg-brand" : "bg-white"}`}>
                        <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-700"}`}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            <Field label={type === "wanted" ? "What do you need?" : "Tell buyers about it"} error={errors.text}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={type === "wanted" ? "e.g. Looking for 2 bags of ofada rice in Yaba" : "e.g. Fresh tomatoes just arrived from Mile 12"}
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={1000}
                textAlignVertical="top"
                className={`${inputClass} h-32`}
              />
            </Field>

            <Field label={`Pictures (${images.length}/${MAX_IMAGES})`} optional>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {images.map((a) => (
                  <View key={a.uri} className="mr-3">
                    <Image source={{ uri: a.uri }} className="h-24 w-24 rounded-2xl bg-gray-200" />
                    <Pressable
                      onPress={() => setImages((p) => p.filter((x) => x.uri !== a.uri))}
                      disabled={submitting}
                      className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-red-600"
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {images.length < MAX_IMAGES ? (
                  <Pressable onPress={pickImages} disabled={submitting} className="h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
                    <Ionicons name="camera-outline" size={26} color="#F97316" />
                    <Text className="mt-1 text-xs font-semibold text-gray-500">Add</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </Field>

            <Field label={type === "wanted" ? "Your budget (₦)" : "Price (₦)"} optional={type === "wanted"} error={errors.price}>
              <TextInput
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className={inputClass}
              />
            </Field>

            {price !== "" ? (
              <Field label="Per" optional>
                <View className="flex-row flex-wrap">
                  {UNITS.map((u) => {
                    const on = unit === u;
                    return (
                      <Pressable key={u} onPress={() => setUnit(on ? "" : u)} className={`mb-2 mr-2 rounded-full px-4 py-2 ${on ? "bg-brand" : "bg-white"}`}>
                        <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-700"}`}>{u}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={submitting}
              className={`mt-8 flex-row items-center justify-center rounded-2xl py-4 ${submitting ? "bg-brand/60" : "bg-brand"}`}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : null}
              <Text className="ml-2 text-base font-extrabold text-white">
                {submitting ? step : editing ? "Save changes" : "Post"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
