import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import PostCard from "../../components/PostCard";
import CommentsSheet from "../../components/CommentsSheet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { cachedApi } from "../../lib/cache";
import { mapPost } from "../../lib/useFeed";
import { useFollowing, usePostActions } from "../../lib/usePostActions";

export default function SavedPosts() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline, watch } = useSocket();
  const myId = String(user?._id ?? user?.id ?? "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);
  const actions = usePostActions(setItems);
  const { following, toggleFollow } = useFollowing();

  useEffect(() => {
    cachedApi("/posts/saved", { auth: true })
      .then((r) => setItems((r.posts ?? []).map(mapPost)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { watch(items.map((p) => p.author?._id)); }, [items, watch]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">Saved posts</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p._id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>🔖</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">Nothing saved yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Tap the bookmark on a post to keep it here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            myId={myId}
            online={isOnline(item.author?._id)}
            following={following.has(item.author?._id)}
            onLike={() => actions.like(item)}
            onSave={() => { actions.save(item); setItems((l) => l.filter((p) => p._id !== item._id)); }}
            onRepost={() => actions.repost(item).catch((e) => Alert.alert("Couldn't repost", e.message))}
            onShare={() => actions.share(item)}
            onComment={() => setCommentsFor(item._id)}
            onFollow={() => toggleFollow(item.author._id)}
            onChat={() => router.push(`/chat/${item.author._id}`)}
            onManage={() => router.push("/posts/manage")}
          />
        )}
      />
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </SafeAreaView>
  );
}
