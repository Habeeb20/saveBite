import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../lib/api";
import { formatNaira } from "../../lib/mockData";

function StockBadge({ p }) {
  if (typeof p.stockQuantity !== "number") return null;
  const out = p.isOutOfStock;
  const low = p.isLowStock;
  const cls = out ? "bg-red-50 text-red-600" : low ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-600";
  const [bg, fg] = cls.split(" ");
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${bg}`}>
      <Text className={`text-xs font-semibold ${fg}`}>
        {out ? "Out of stock" : low ? `Low: ${p.stockQuantity} left` : `${p.stockQuantity} in stock`}
      </Text>
    </View>
  );
}

export default function MyProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { products: list } = await api("/products/mine?limit=50", { auth: true });
      setProducts(list);
    } catch (e) {
      Alert.alert("Couldn't load products", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = (p) =>
    Alert.alert("Delete product?", `"${p.name}" will be removed from your shop.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/products/${p._id}`, { method: "DELETE", auth: true });
            setProducts((prev) => prev.filter((x) => x._id !== p._id));
          } catch (e) {
            Alert.alert("Couldn't delete", e.message);
          }
        },
      },
    ]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>
          <Text className="ml-1 text-xl font-extrabold text-gray-900">My products</Text>
        </View>
        <Pressable onPress={() => router.push("/products/create")} className="rounded-full bg-brand px-4 py-2">
          <Text className="text-sm font-bold text-white">Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#F97316" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#F97316"
            />
          }
          ListEmptyComponent={
            <View className="items-center rounded-3xl bg-white px-6 py-10">
              <Text style={{ fontSize: 38 }}>🛒</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No products yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Add your first product so buyers can find it.</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <View className="mb-3 flex-row items-center rounded-3xl bg-white p-3">
              <Image source={{ uri: p.images?.[0]?.url }} className="h-16 w-16 rounded-2xl bg-gray-200" />
              <View className="ml-3 flex-1">
                <Text numberOfLines={1} className="text-sm font-bold text-gray-900">{p.name}</Text>
                <Text className="mb-1 text-sm font-semibold text-brand">{formatNaira(p.price)}</Text>
                <StockBadge p={p} />
              </View>
              <Pressable onPress={() => remove(p)} className="h-10 w-10 items-center justify-center">
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}