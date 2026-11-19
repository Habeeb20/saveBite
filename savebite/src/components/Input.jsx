import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Input({ label, icon, error, secure = false, ...props }) {
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);

  const border = error ? "border-red-500" : focused ? "border-brand" : "border-gray-200";

  return (
    <View className="mb-4">
      {label ? <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text> : null}

      <View className={`flex-row items-center rounded-2xl border bg-white px-4 ${border}`}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? "#F97316" : "#9CA3AF"} /> : null}
        <TextInput
          className="ml-3 flex-1 py-4 text-base text-gray-900"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}
