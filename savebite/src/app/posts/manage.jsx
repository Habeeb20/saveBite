import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import Image from "../../components/CachedImage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { cachedApi } from "../../lib/cache";
import { mutate } from "../../lib/outbox";
import { mapPost } from "../../lib/useFeed";
import { formatNaira } from "../../lib/mockData";

const TYPE_LABEL = { stock: "In stock", menu: "Menu", wanted: "Wanted" };

export default function ManagePosts() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);

  const load = useCallback(async (after) => {
    const r = await cachedApi(`/posts/mine?limit=15${after ? `&cursor=${encodeURIComponent(after)}` : ""}`, { auth: true });
    return { posts: (r.posts ?? []).map(mapPost), next: r.nextCursor };
  }, []);

  const refresh = useCallback(async () => {
    try { const { posts, next } = await load(null); setItems(posts); setCursor(next); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, [load]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh])); // reloads after you edit one

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try { const { posts, next } = await load(cursor); setItems((p) => [...p, ...posts]); setCursor(next); }
    catch {} finally { setMore(false); }
  };

  const remove = (post) =>
    Alert.alert("Delete this post?", "Its likes, comments and reposts will be removed too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await mutate({ kind: "post-delete", method: "DELETE", path: `/posts/${post._id}`, dedupeKey: `post:${post._id}` });
            setItems((l) => l.filter((p) => p._id !== post._id));
          } catch (e) { Alert.alert("Couldn't delete", e.message || "Please try again."); }
        },
      },
    ]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 flex-1 text-xl font-extrabold text-gray-900">My posts</Text>
        <Pressable onPress={() => router.push("/posts/create")} className="flex-row items-center rounded-full bg-brand px-4 py-2">
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="ml-1 text-sm font-bold text-white">New</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.feedId}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor="#F97316" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={more ? <ActivityIndicator color="#F97316" style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>📝</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">You haven't posted yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Share your stock, a menu or a request with the community.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View className="mb-3 rounded-3xl bg-white p-4">
            <View className="flex-row">
              {item.images?.[0]?.url ? (
                <Image source={{ uri: item.images[0].url }} className="h-16 w-16 rounded-2xl bg-gray-200" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-tint">
                  <Text style={{ fontSize: 28 }}>{item.type === "menu" ? "🍲" : item.type === "wanted" ? "🔎" : "🥬"}</Text>
                </View>
              )}
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <View className="rounded-full bg-brand-tint px-2.5 py-0.5">
                    <Text className="text-xs font-semibold text-brand">{TYPE_LABEL[item.type]}</Text>
                  </View>
                  <Text className="ml-2 text-xs text-gray-400">{item.time} ago</Text>
                </View>
                <Text numberOfLines={2} className="mt-1 text-sm text-gray-800">{item.text}</Text>
                {item.price ? (
                  <Text className="mt-0.5 text-sm font-bold text-gray-900">
                    {formatNaira(item.price)}{item.unit ? ` / ${item.unit}` : ""}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="mt-3 flex-row items-center">
              <Ionicons name="heart-outline" size={16} color="#6B7280" />
              <Text className="ml-1 mr-4 text-xs text-gray-600">{item.likes}</Text>
              <Ionicons name="chatbubble-outline" size={15} color="#6B7280" />
              <Text className="ml-1 mr-4 text-xs text-gray-600">{item.comments}</Text>
              <Ionicons name="repeat" size={16} color="#6B7280" />
              <Text className="ml-1 mr-4 text-xs text-gray-600">{item.reposts}</Text>
              <Ionicons name="paper-plane-outline" size={15} color="#6B7280" />
              <Text className="ml-1 text-xs text-gray-600">{item.shares}</Text>
            </View>

            <View className="mt-3 flex-row border-t border-gray-100 pt-3">
              <Pressable onPress={() => router.push({ pathname: "/posts/create", params: { id: item._id } })} className="mr-2 flex-1 flex-row items-center justify-center rounded-full border border-gray-300 py-2">
                <Ionicons name="create-outline" size={16} color="#374151" />
                <Text className="ml-1.5 text-sm font-bold text-gray-700">Edit</Text>
              </Pressable>
              <Pressable onPress={() => remove(item)} className="ml-2 flex-1 flex-row items-center justify-center rounded-full bg-red-50 py-2">
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text className="ml-1.5 text-sm font-bold text-red-600">Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
