import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { cachedApi } from "../lib/cache";
import { mutate } from "../lib/outbox";
import { timeAgo } from "../lib/time";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Avatar } from "./PostCard";

export default function CommentsSheet({ postId, onClose }) {
  const { user } = useAuth();
  const { socket, isOnline } = useSocket();
  const myId = String(user?._id ?? user?.id ?? "");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const add = useCallback((c) => setComments((l) => (l.some((x) => x._id === c._id) ? l : [c, ...l])), []);

  useEffect(() => {
    if (!postId) return;
    let live = true;
    setComments([]);
    setText("");
    setLoading(true);
    cachedApi(`/posts/${postId}/comments`, { auth: true })
      .then((r) => live && setComments(r.comments ?? []))
      .catch(() => {})
      .finally(() => live && setLoading(false));

    // live comments from other people while the sheet is open
    socket?.emit("post:join", postId);
    const onNew = (e) => e.postId === postId && add(e.comment);
    const onDel = (e) => e.postId === postId && setComments((l) => l.filter((c) => c._id !== e.commentId));
    socket?.on("comment:new", onNew);
    socket?.on("comment:deleted", onDel);
    return () => {
      live = false;
      socket?.emit("post:leave", postId);
      socket?.off("comment:new", onNew);
      socket?.off("comment:deleted", onDel);
    };
  }, [postId, socket, add]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      // show it straight away; it is sent now, or when you're back online
      const tempId = `tmp-${Date.now()}`;
      add({
        _id: tempId, postId, text: t, createdAt: new Date().toISOString(),
        author: { _id: myId, name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "You", avatar: null },
      });
      setText("");
      try {
        const r = await mutate({ kind: "comment", path: `/posts/${postId}/comments`, body: { text: t } });
        if (!r.queued) {
          setComments((l) => l.map((c) => (c._id === tempId ? r.result.comment : c)).filter((c, i, arr) => arr.findIndex((x) => x._id === c._id) === i));
        }
      } catch (err) {
        setComments((l) => l.filter((c) => c._id !== tempId));
        throw err;
      }
    } catch (e) {
      Alert.alert("Couldn't comment", e.message || "Please try again.");
    } finally { setSending(false); }
  };

  const remove = (c) =>
    Alert.alert("Delete comment?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api(`/posts/${postId}/comments/${c._id}`, { method: "DELETE", auth: true });
            setComments((l) => l.filter((x) => x._id !== c._id));
          } catch (e) { Alert.alert("Couldn't delete", e.message || "Please try again."); }
        },
      },
    ]);

  return (
    <Modal visible={!!postId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-cream">
        <View className="flex-row items-center justify-between px-6 pb-3 pt-4">
          <Text className="text-xl font-extrabold text-gray-900">Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <FlatList
            data={comments}
            keyExtractor={(c) => c._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color="#F97316" style={{ marginTop: 40 }} />
              ) : (
                <View className="items-center py-16">
                  <Text style={{ fontSize: 40 }}>💬</Text>
                  <Text className="mt-3 text-base font-semibold text-gray-900">No comments yet</Text>
                  <Text className="text-sm text-gray-500">Be the first to say something.</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View className="mb-4 flex-row">
                <Avatar author={item.author} online={isOnline(item.author?._id)} size={36} />
                <View className="ml-3 flex-1 rounded-2xl bg-white px-4 py-3">
                  <View className="flex-row items-center">
                    <Text numberOfLines={1} className="shrink text-sm font-bold text-gray-900">{item.author?.name}</Text>
                    <Text className="ml-2 text-xs text-gray-400">{timeAgo(item.createdAt)}</Text>
                    <View className="flex-1" />
                    {item.author?._id === myId ? (
                      <Pressable onPress={() => remove(item)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-sm leading-5 text-gray-800">{item.text}</Text>
                </View>
              </View>
            )}
          />

          <View className="flex-row items-end border-t border-gray-200 bg-cream px-4 py-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              className="max-h-28 flex-1 rounded-2xl bg-white px-4 py-3 text-base text-gray-900"
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${text.trim() ? "bg-brand" : "bg-gray-300"}`}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
