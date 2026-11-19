import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import PostCard from "../../components/PostCard";
import CommentsSheet from "../../components/CommentsSheet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useFeed } from "../../lib/useFeed";
import { useFollowing, usePostActions } from "../../lib/usePostActions";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "stock", label: "Foodstuff" },
  { id: "menu", label: "Ready to eat" },
  { id: "wanted", label: "Wanted" },
];

export default function Feed() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline, watch, unread } = useSocket();
  const listRef = useRef(null);

  const [filter, setFilter] = useState("all");
  const [commentsFor, setCommentsFor] = useState(null);

  const feed = useFeed(filter);
  const actions = usePostActions(feed.setItems);
  const { following, toggleFollow } = useFollowing();

  const myId = String(user?._id ?? user?.id ?? "");
  const isSeller = user?.roles?.includes("seller");

  // green / grey dots: subscribe to the people whose posts are on screen
  useEffect(() => {
    watch(feed.items.flatMap((p) => [p.author?._id, p.repostedBy?._id]));
  }, [feed.items, watch]);

  const showNew = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    feed.reload();
  };

  const repost = (id) => actions.repost(id).catch((e) => Alert.alert("Couldn't repost", e.message || "Please try again."));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-6 pb-3 pt-2">
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-gray-900">Community</Text>
          <Text className="text-sm text-gray-500">Fresh stock, prices and requests from around you</Text>
        </View>
        <Pressable onPress={() => router.push("/chat")} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <Ionicons name="chatbubbles-outline" size={22} color="#1F2937" />
          {unread.chat > 0 ? (
            <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center rounded-full bg-brand px-1">
              <Text className="text-[10px] font-bold text-white">{unread.chat > 9 ? "9+" : unread.chat}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={feed.items}
        keyExtractor={(p) => p.feedId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => feed.reload(true)} tintColor="#F97316" />}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(f) => f.id}
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
            renderItem={({ item }) => {
              const on = filter === item.id;
              return (
                <Pressable
                  onPress={() => setFilter(item.id)}
                  className={`rounded-full border px-4 py-2 ${on ? "border-brand bg-brand" : "border-gray-200 bg-white"}`}
                >
                  <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-700"}`}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            myId={myId}
            online={isOnline(item.author?._id)}
            following={following.has(item.author?._id)}
            onLike={() => actions.like(item._id)}
            onSave={() => actions.save(item._id)}
            onRepost={() => repost(item._id)}
            onShare={() => actions.share(item)}
            onComment={() => setCommentsFor(item._id)}
            onFollow={() => toggleFollow(item.author._id)}
            onChat={() => router.push(`/chat/${item.author._id}`)}
            onManage={() => router.push("/posts/manage")}
          />
        )}
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color="#F97316" style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          feed.loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : feed.error ? (
            <View className="items-center py-16">
              <Text style={{ fontSize: 44 }}>📡</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">Couldn't load posts</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">{feed.error}</Text>
              <Pressable onPress={() => feed.reload()} className="mt-4 rounded-full bg-brand px-5 py-2.5">
                <Text className="text-sm font-bold text-white">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center py-16">
              <Text style={{ fontSize: 44 }}>📭</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No posts here yet</Text>
            </View>
          )
        }
      />

      {/* live: someone just posted */}
      {feed.newCount > 0 ? (
        <Pressable
          onPress={showNew}
          style={{ position: "absolute", top: 92, alignSelf: "center" }}
          className="flex-row items-center rounded-full bg-gray-900 px-4 py-2 shadow-lg"
        >
          <Ionicons name="arrow-up" size={14} color="#fff" />
          <Text className="ml-1.5 text-xs font-bold text-white">
            {feed.newCount} new post{feed.newCount === 1 ? "" : "s"}
          </Text>
        </Pressable>
      ) : null}

      {/* sellers post stock or a menu; buyers post a "wanted" request */}
      <Pressable
        onPress={() => router.push("/posts/create")}
        className="absolute bottom-6 right-6 flex-row items-center rounded-full bg-brand px-5 py-3.5 shadow-lg"
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text className="ml-1 text-base font-bold text-white">{isSeller ? "Post" : "Request"}</Text>
      </Pressable>

      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </SafeAreaView>
  );
}
