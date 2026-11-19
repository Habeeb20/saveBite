import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../components/PostCard";
import { useSocket } from "../context/SocketContext";
import { api } from "../lib/api";
import { timeAgo } from "../lib/time";

const ICON = {
  like: ["heart", "#EF4444"], comment: ["chatbubble", "#2563EB"], repost: ["repeat", "#16A34A"],
  follow: ["person-add", "#F97316"], post: ["restaurant", "#F97316"], message: ["chatbubbles", "#7C3AED"],
};

export default function Notifications() {
  const router = useRouter();
  const { socket, setUnread, isOnline, watch } = useSocket();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (after) => {
    const r = await api(`/notifications${after ? `?cursor=${encodeURIComponent(after)}` : ""}`, { auth: true });
    return { rows: r.notifications ?? [], next: r.nextCursor };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { rows, next } = await load(null);
      setItems(rows);
      setCursor(next);
      // opening this screen marks everything as read (the dots below still show what was new)
      api("/notifications/read-all", { method: "POST", auth: true }).catch(() => {});
      setUnread((u) => ({ ...u, notifications: 0 }));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [load, setUnread]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { watch(items.map((n) => n.actor?._id)); }, [items, watch]);

  // live: a new notification arrives while this screen is open
  useEffect(() => {
    if (!socket) return;
    const onNew = (n) => { setItems((l) => [n, ...l]); setUnread((u) => ({ ...u, notifications: 0 })); };
    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [socket, setUnread]);

  const loadMore = async () => {
    if (!cursor) return;
    try { const { rows, next } = await load(cursor); setItems((l) => [...l, ...rows]); setCursor(next); } catch {}
  };

  const open = (n) => {
    if (n.type === "message" || n.type === "follow") router.push(`/chat/${n.actor._id}`);
    else router.push("/feed");
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">Notifications</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n._id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor="#F97316" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>🔔</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">Nothing yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Likes, comments, follows and posts from people you follow show up here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const [icon, color] = ICON[item.type] ?? ICON.post;
          return (
            <Pressable onPress={() => open(item)} className={`mb-2 flex-row items-center rounded-3xl p-3 ${item.read ? "bg-white" : "bg-brand-tint"}`}>
              <View>
                <Avatar author={item.actor} online={isOnline(item.actor?._id)} size={46} />
                <View className="absolute -left-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-white">
                  <Ionicons name={icon} size={12} color={color} />
                </View>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm text-gray-800">
                  <Text className="font-bold text-gray-900">{item.actor?.name} </Text>
                  {item.text}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-400">{timeAgo(item.createdAt)} ago</Text>
              </View>
              {!item.read ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
