import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Avatar } from "../../components/PostCard";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { cachedApi } from "../../lib/cache";
import { timeAgo } from "../../lib/time";

export default function ChatInbox() {
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isOnline, watch, refreshUnread } = useSocket();
  const myId = String(user?._id ?? user?.id ?? "");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await cachedApi("/chat/conversations", { auth: true });
      setRows(r.conversations ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); refreshUnread(); }, [load, refreshUnread]));

  // new message / read receipt -> refresh the list live
  useEffect(() => {
    if (!socket) return;
    socket.on("message:new", load);
    socket.on("message:read", load);
    return () => { socket.off("message:new", load); socket.off("message:read", load); };
  }, [socket, load]);

  useEffect(() => { watch(rows.map((r) => r.other?._id)); }, [rows, watch]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-gray-900">Messages</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(c) => c._id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F97316" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }}>💬</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">No conversations yet</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Tap Chat on a post to message a seller or buyer.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.other._id}`)}
            className="mb-3 flex-row items-center rounded-3xl bg-white p-3"
          >
            <Avatar author={item.other} online={isOnline(item.other?._id)} size={48} />
            <View className="ml-3 flex-1">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="shrink text-base font-bold text-gray-900">{item.other?.name}</Text>
                {item.lastMessage ? <Text className="ml-2 text-xs text-gray-400">{timeAgo(item.lastMessage.createdAt)}</Text> : null}
              </View>
              <View className="mt-0.5 flex-row items-center">
                <Text numberOfLines={1} className={`flex-1 text-sm ${item.unread ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                  {item.lastMessage ? `${item.lastMessage.sender === myId ? "You: " : ""}${item.lastMessage.text}` : ""}
                </Text>
                {item.unread > 0 ? (
                  <View className="ml-2 min-w-[20px] items-center rounded-full bg-brand px-1.5 py-0.5">
                    <Text className="text-xs font-bold text-white">{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
