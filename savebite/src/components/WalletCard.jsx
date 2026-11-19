import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatNaira } from "../lib/mockData";

/**
 * Dark wallet card. `actions` is [{ icon, label, onPress }]; the first one is highlighted.
 */
export default function WalletCard({ balance = 0, loading = false, actions = [], onPress }) {
  const [hidden, setHidden] = useState(false);

  const amount = hidden ? "₦ ••••••" : loading ? "₦ ----" : formatNaira(balance);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="overflow-hidden rounded-3xl bg-gray-900 p-5"
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -44,
          top: -44,
          height: 160,
          width: 160,
          borderRadius: 80,
          backgroundColor: "#F97316",
          opacity: 0.2,
        }}
      />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-300">SaveBite Wallet</Text>
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12}>
          <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color="#D1D5DB" />
        </Pressable>
      </View>

      <Text className="mt-2 text-4xl font-extrabold text-white">{amount}</Text>

      {actions.length ? (
        <View className="mt-5 flex-row flex-wrap">
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              className="mb-2 mr-2 flex-row items-center rounded-full px-4 py-2.5"
              style={{ backgroundColor: i === 0 ? "#F97316" : "rgba(255,255,255,0.12)" }}
            >
              <Ionicons name={a.icon} size={16} color="#FFFFFF" />
              <Text className="ml-1.5 text-sm font-semibold text-white">{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}