import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "../../components/PostCard";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";
import { cachedApi, readCache, writeCache } from "../../lib/cache";
import { isNetworkError } from "../../lib/network";
import { mutate } from "../../lib/outbox";
import { useSync } from "../../context/SyncContext";
import { clock, lastSeenText } from "../../lib/time";
import { setActiveChat } from "../../lib/usePushNotifications";

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const otherId = String(id);
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isOnline, watch, refreshUnread } = useSocket();
  const myId = String(user?._id ?? user?.id ?? "");
  const { refreshTick } = useSync();

  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]); // newest first (the list is inverted)
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const typingTimer = useRef(null);
  const loadingOlder = useRef(false);

  // while this chat is open, don't show a banner for this person's messages
  useEffect(() => {
    setActiveChat(otherId);
    return () => setActiveChat(null);
  }, [otherId]);

  const convId = conv?._id;
  const other = conv?.other;

  const upsert = useCallback((m) => {
    setMessages((list) => {
      const i = list.findIndex((x) => x._id === m._id || (m.clientId && x.clientId === m.clientId));
      if (i >= 0) { const copy = [...list]; copy[i] = { ...list[i], ...m, pending: false, failed: false, queued: false }; return copy; }
      return [m, ...list];
    });
  }, []);

  // open the conversation + first page of messages
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let c;
        try {
          c = await api("/chat/conversations", { method: "POST", auth: true, body: { userId: otherId } });
          writeCache(`chat-open:${otherId}`, c);
        } catch (e) {
          if (!isNetworkError(e)) throw e;
          const hit = await readCache(`chat-open:${otherId}`);
          // never opened before + offline: you can still write; it sends when you're online
          c = hit ? hit.data : { conversation: { _id: null, other: { _id: otherId, name: "Chat" } } };
        }
        const m = c.conversation._id
          ? await cachedApi(`/chat/conversations/${c.conversation._id}/messages`, { auth: true }).catch(() => ({ messages: [], hasMore: false }))
          : { messages: [], hasMore: false };
        if (!live) return;
        setConv(c.conversation);
        setMessages((old) => {
          const waiting = old.filter((x) => x.queued || x.pending); // keep messages still waiting to send
          return [...waiting, ...(m.messages ?? []).filter((x) => !waiting.some((w) => w.clientId && w.clientId === x.clientId))];
        });
        setHasMore(!!m.hasMore);
        watch([otherId]);
      } catch (e) {
        if (live) setError(e?.message || "Couldn't open this chat");
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [otherId, watch, refreshTick]);

  const markRead = useCallback(() => {
    if (!convId) return;
    if (socket?.connected) socket.emit("message:read", { conversationId: convId });
    else api(`/chat/conversations/${convId}/read`, { method: "POST", auth: true }).catch(() => {});
    setTimeout(refreshUnread, 500);
  }, [convId, socket, refreshUnread]);

  useEffect(() => { markRead(); }, [markRead]);

  // live messages, read receipts, typing
  useEffect(() => {
    if (!socket || !convId) return;
    const onMsg = (m) => {
      if (m.conversationId !== convId) return;
      upsert(m);
      if (m.sender !== myId) markRead();
    };
    const onRead = (e) => {
      if (e.conversationId !== convId || e.by !== otherId) return;
      setMessages((l) => l.map((m) => (m.sender === myId && !m.readAt ? { ...m, readAt: e.readAt } : m)));
    };
    const onTyping = (e) => { if (e.from === otherId) setTyping(!!e.typing); };
    socket.on("message:new", onMsg);
    socket.on("message:read", onRead);
    socket.on("typing", onTyping);
    return () => { socket.off("message:new", onMsg); socket.off("message:read", onRead); socket.off("typing", onTyping); };
  }, [socket, convId, myId, otherId, upsert, markRead]);

  const emitTyping = (on) => socket?.emit("typing", { to: otherId, typing: on });
  const onChangeText = (t) => {
    setText(t);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    clearTimeout(typingTimer.current);
    emitTyping(false);

    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    upsert({ _id: clientId, clientId, conversationId: convId, sender: myId, text: t, createdAt: new Date().toISOString(), readAt: null, pending: true });
    const fail = () => setMessages((l) => l.map((m) => (m.clientId === clientId ? { ...m, failed: true, pending: false } : m)));

    // no connection: save the message on the phone and send it when we're back online
    const viaQueue = async () => {
      try {
        const r = await mutate({ kind: "message", path: "/chat/messages", body: { to: otherId, text: t, clientId } });
        if (r.queued) setMessages((l) => l.map((m) => (m.clientId === clientId ? { ...m, pending: false, queued: true } : m)));
        else upsert(r.result.message);
      } catch { fail(); }
    };

    if (socket?.connected) {
      socket.timeout(6000).emit("message:send", { to: otherId, text: t, clientId }, (err, ack) => {
        if (!err && ack?.ok) upsert(ack.message);
        else viaQueue(); // timed out or failed: the server ignores a repeat of the same clientId
      });
    } else {
      viaQueue();
    }
  };

  const loadOlder = async () => {
    if (!hasMore || !convId || loadingOlder.current || !messages.length) return;
    loadingOlder.current = true;
    try {
      const before = messages[messages.length - 1].createdAt;
      const r = await api(`/chat/conversations/${convId}/messages?before=${encodeURIComponent(before)}`, { auth: true });
      setMessages((l) => [...l, ...(r.messages ?? []).filter((m) => !l.some((x) => x._id === m._id))]);
      setHasMore(!!r.hasMore);
    } catch {} finally { loadingOlder.current = false; }
  };

  const online = isOnline(otherId);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
      <View className="flex-row items-center border-b border-gray-200 px-3 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Avatar author={other} online={online} size={40} />
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-base font-bold text-gray-900">{other?.name ?? " "}</Text>
          <Text className={`text-xs ${typing || online ? "text-green-600" : "text-gray-500"}`}>
            {typing ? "typing..." : online ? "Online" : lastSeenText(other?.lastSeen)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        {loading ? (
          <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
        ) : error ? (
          <Text className="mt-16 px-10 text-center text-sm text-gray-500">{error}</Text>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m._id}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            ListEmptyComponent={
              <Text className="py-10 text-center text-sm text-gray-400" style={{ transform: [{ scaleY: -1 }] }}>
                Say hello to {other?.name ?? "them"} 👋
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender === myId;
              return (
                <View className={`mb-2 max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                  <View className={`rounded-2xl px-4 py-2.5 ${mine ? "rounded-br-md bg-brand" : "rounded-bl-md bg-white"}`}>
                    <Text className={`text-base ${mine ? "text-white" : "text-gray-900"}`}>{item.text}</Text>
                  </View>
                  <View className={`mt-0.5 flex-row items-center ${mine ? "justify-end" : ""}`}>
                    <Text className="text-[10px] text-gray-400">{item.failed ? "Not sent" : item.queued ? "Will send when online" : item.pending ? "Sending..." : clock(item.createdAt)}</Text>
                    {mine && !item.pending && !item.queued && !item.failed ? (
                      <Ionicons name="checkmark-done" size={13} color={item.readAt ? "#2563EB" : "#9CA3AF"} style={{ marginLeft: 3 }} />
                    ) : null}
                    {item.failed ? <Ionicons name="alert-circle" size={13} color="#DC2626" style={{ marginLeft: 3 }} /> : null}
                  </View>
                </View>
              );
            }}
          />
        )}

        <View className="flex-row items-end border-t border-gray-200 px-4 py-3">
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Type a message"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            className="max-h-28 flex-1 rounded-2xl bg-white px-4 py-3 text-base text-gray-900"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || !convId}
            className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${text.trim() ? "bg-brand" : "bg-gray-300"}`}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
