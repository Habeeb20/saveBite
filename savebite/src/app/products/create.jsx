import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, ApiError } from "../../lib/api";
import { uploadImages } from "../../lib/cloudinary";

const MAX_IMAGES = 6;
const CATEGORIES = [
  "grains", "tubers", "vegetables", "fruits", "meat", "fish",
  "poultry", "oils", "spices", "cooked meals", "snacks", "drinks", "other",
];

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

const inputClass = "rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";

export default function CreateProduct() {
  const router = useRouter();
  const [images, setImages] = useState([]); // picker assets (local files)
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(""); // "Uploading images..." / "Saving..."

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to add product pictures.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (result.canceled) return;
    setImages((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
    setErrors((e) => ({ ...e, images: undefined }));
  };

  const removeImage = (uri) => setImages((prev) => prev.filter((a) => a.uri !== uri));

  const validate = () => {
    const e = {};
    if (!images.length) e.images = "Add at least one picture";
    if (name.trim().length < 2) e.name = "Enter the product name";
    if (price === "" || isNaN(Number(price)) || Number(price) < 0) e.price = "Enter a valid price";
    if (!category) e.category = "Choose a category";
    if (stock !== "" && !/^\d+$/.test(stock)) e.stockQuantity = "Use a whole number";
    if (lowStock !== "" && !/^\d+$/.test(lowStock)) e.lowStockAlert = "Use a whole number";
    if (stock !== "" && lowStock !== "" && /^\d+$/.test(stock) && /^\d+$/.test(lowStock) && Number(lowStock) > Number(stock)) {
      e.lowStockAlert = "Alert level can't be higher than your stock";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      setStep("Uploading images...");
      const uploaded = await uploadImages(images); // [{ url, publicId }]

      setStep("Saving product...");
      await api("/products", {
        method: "POST",
        auth: true,
        body: {
          name: name.trim(),
          price: Number(price),
          category,
          description: description.trim(),
          images: uploaded,
          stockQuantity: stock === "" ? null : Number(stock),
          lowStockAlert: lowStock === "" ? null : Number(lowStock),
        },
      });
      Alert.alert("Product added", `${name.trim()} is now in your shop.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      Alert.alert("Couldn't add product", e.message || "Please try again.");
    } finally {
      setSubmitting(false);
      setStep("");
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">New product</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* images */}
          <Field label={`Pictures (${images.length}/${MAX_IMAGES})`} error={errors.images}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {images.map((a, i) => (
                <View key={a.uri} className="mr-3">
                  <Image source={{ uri: a.uri }} className="h-24 w-24 rounded-2xl bg-gray-200" />
                  {i === 0 ? (
                    <View className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-white">Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => removeImage(a.uri)}
                    disabled={submitting}
                    className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-red-600"
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_IMAGES ? (
                <Pressable
                  onPress={pickImages}
                  disabled={submitting}
                  className="h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white"
                >
                  <Ionicons name="camera-outline" size={26} color="#F97316" />
                  <Text className="mt-1 text-xs font-semibold text-gray-500">Add</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Field>

          <Field label="Product name" error={errors.name}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ofada rice, 50kg bag"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
              className={inputClass}
            />
          </Field>

          <Field label="Price (₦)" error={errors.price}>
            <TextInput
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              className={inputClass}
            />
          </Field>

          <Field label="Category" error={errors.category}>
            <View className="flex-row flex-wrap">
              {CATEGORIES.map((c) => {
                const on = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCategory(c);
                      setErrors((e) => ({ ...e, category: undefined }));
                    }}
                    className={`mb-2 mr-2 rounded-full px-4 py-2 ${on ? "bg-brand" : "bg-white"}`}
                  >
                    <Text className={`text-sm font-semibold capitalize ${on ? "text-white" : "text-gray-700"}`}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Description" optional error={errors.description}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell buyers about quality, size, how it's prepared..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              className={`${inputClass} h-28`}
            />
          </Field>

          <View className="flex-row">
            <View className="mr-2 flex-1">
              <Field label="Stock quantity" optional error={errors.stockQuantity}>
                <TextInput
                  value={stock}
                  onChangeText={(t) => setStock(t.replace(/\D/g, ""))}
                  placeholder="e.g. 40"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  className={inputClass}
                />
              </Field>
            </View>
            <View className="ml-2 flex-1">
              <Field label="Low stock alert" optional error={errors.lowStockAlert}>
                <TextInput
                  value={lowStock}
                  onChangeText={(t) => setLowStock(t.replace(/\D/g, ""))}
                  placeholder="e.g. 5"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  className={inputClass}
                />
              </Field>
            </View>
          </View>
          <Text className="mt-1.5 text-xs text-gray-500">
            We'll flag this product on your dashboard when stock drops to the alert level.
          </Text>

          <Pressable
            onPress={submit}
            disabled={submitting}
            className={`mt-8 flex-row items-center justify-center rounded-2xl py-4 ${submitting ? "bg-brand/60" : "bg-brand"}`}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : null}
            <Text className="ml-2 text-base font-extrabold text-white">{submitting ? step : "Add product"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}