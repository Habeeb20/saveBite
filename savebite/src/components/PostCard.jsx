import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatNaira } from "../lib/mockData";

const TYPE_LABEL = { stock: "In stock", menu: "Menu", wanted: "Wanted" };
const FALLBACK_EMOJI = { stock: "🥬", menu: "🍲", wanted: "🔎" };

// Avatar with the green (online) / grey (offline) dot
export function Avatar({ author, online, size = 44, dot = true }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={{ width: size, height: size }}>
      {author?.avatar ? (
        <Image source={{ uri: author.avatar }} style={box} className="bg-gray-200" />
      ) : (
        <View style={box} className="items-center justify-center bg-brand-tint">
          <Text style={{ fontSize: size * 0.42 }} className="font-extrabold text-brand">
            {(author?.name?.[0] ?? "?").toUpperCase()}
          </Text>
        </View>
      )}
      {dot ? (
        <View
          className={`absolute h-3.5 w-3.5 rounded-full border-2 border-white ${online ? "bg-green-500" : "bg-gray-300"}`}
          style={{ right: -1, bottom: -1 }}
        />
      ) : null}
    </View>
  );
}

export default function PostCard({
  post, myId, online, following,
  onLike, onSave, onRepost, onShare, onComment, onChat, onFollow, onManage,
}) {
  const author = post.author;
  const isMine = !!myId && author?._id === myId;
  const likes = post.likes ?? 0;
  const cover = post.images?.[0]?.url;

  return (
    <View className="mb-4 rounded-3xl bg-white p-4">
      {post.repostedBy ? (
        <View className="mb-2 flex-row items-center">
          <Ionicons name="repeat" size={14} color="#6B7280" />
          <Text className="ml-1 text-xs text-gray-500">{post.repostedBy.name} reposted</Text>
        </View>
      ) : null}

      {/* author */}
      <View className="flex-row items-center">
        <Avatar author={author} online={online} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text numberOfLines={1} className="shrink text-sm font-bold text-gray-900">
              {author?.name}
            </Text>
            {author?.verified ? <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginLeft: 4 }} /> : null}
            {!isMine && !following && onFollow ? (
              <Pressable onPress={onFollow} hitSlop={8} className="ml-2">
                <Text className="text-xs font-bold text-brand">Follow</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="text-xs text-gray-500">
            {author?.area ? `${author.area} · ` : ""}
            {post.time} ago
          </Text>
        </View>
        <View className={`rounded-full px-3 py-1 ${post.type === "wanted" ? "bg-blue-50" : "bg-brand-tint"}`}>
          <Text className={`text-xs font-semibold ${post.type === "wanted" ? "text-blue-600" : "text-brand"}`}>
            {TYPE_LABEL[post.type]}
          </Text>
        </View>
      </View>

      {/* text */}
      <Text className="mt-3 text-base leading-6 text-gray-800">{post.text}</Text>

      {/* picture + price */}
      <View
        style={{ backgroundColor: post.tint || "#FFF3E6" }}
        className="mt-3 h-44 items-center justify-center overflow-hidden rounded-2xl"
      >
        {cover ? (
          <Image source={{ uri: cover }} resizeMode="cover" className="h-44 w-full" />
        ) : (
          <Text style={{ fontSize: 84 }}>{post.emoji || FALLBACK_EMOJI[post.type]}</Text>
        )}
        {post.images?.length > 1 ? (
          <View className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1">
            <Text className="text-xs font-bold text-white">+{post.images.length - 1}</Text>
          </View>
        ) : null}
        {post.price ? (
          <View className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1.5">
            <Text className="text-sm font-extrabold text-gray-900">
              {formatNaira(post.price)}
              {post.unit ? <Text className="text-xs font-medium text-gray-500"> / {post.unit}</Text> : null}
            </Text>
          </View>
        ) : null}
      </View>

      {/* actions */}
      <View className="mt-3 flex-row items-center">
        <Pressable onPress={onLike} hitSlop={8} className="mr-5 flex-row items-center">
          <Ionicons name={post.liked ? "heart" : "heart-outline"} size={22} color={post.liked ? "#EF4444" : "#4B5563"} />
          <Text className="ml-1.5 text-sm text-gray-600">{likes}</Text>
        </Pressable>
        <Pressable onPress={onComment} hitSlop={8} className="mr-5 flex-row items-center">
          <Ionicons name="chatbubble-outline" size={21} color="#4B5563" />
          <Text className="ml-1.5 text-sm text-gray-600">{post.comments ?? 0}</Text>
        </Pressable>
        {!isMine ? (
          <Pressable onPress={onRepost} hitSlop={8} className="mr-5 flex-row items-center">
            <Ionicons name="repeat" size={22} color={post.reposted ? "#16A34A" : "#4B5563"} />
            <Text className={`ml-1 text-sm ${post.reposted ? "text-green-600" : "text-gray-600"}`}>{post.reposts ?? 0}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onShare} hitSlop={8}>
          <Ionicons name="paper-plane-outline" size={21} color="#4B5563" />
        </Pressable>
        <View className="flex-1" />
        <Pressable onPress={onSave} hitSlop={8} className="mr-4">
          <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={21} color={post.saved ? "#F97316" : "#4B5563"} />
        </Pressable>
        <Pressable
          onPress={isMine ? onManage : onChat}
          className="flex-row items-center rounded-full bg-brand px-4 py-2"
        >
          <Ionicons name={isMine ? "create" : "chatbubbles"} size={15} color="#FFFFFF" />
          <Text className="ml-1.5 text-sm font-bold text-white">
            {isMine ? "Manage" : post.type === "wanted" ? "Reply" : "Chat"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
