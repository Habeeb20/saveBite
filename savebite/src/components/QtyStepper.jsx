import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// - [ 2 ] +   (going below 1 removes the item: onChange(0))
export default function QtyStepper({ qty, onChange, max = 99, small }) {
  const h = small ? "h-8" : "h-9";
  return (
    <View className={`${h} flex-row items-center justify-between rounded-full bg-brand-tint px-1`}>
      <Pressable onPress={() => onChange(qty - 1)} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-full bg-white">
        <Ionicons name={qty <= 1 ? "trash-outline" : "remove"} size={15} color="#F97316" />
      </Pressable>
      <Text className="mx-2 min-w-[18px] text-center text-sm font-extrabold text-gray-900">{qty}</Text>
      <Pressable
        onPress={() => qty < max && onChange(qty + 1)}
        hitSlop={6}
        className={`h-7 w-7 items-center justify-center rounded-full ${qty >= max ? "bg-gray-200" : "bg-brand"}`}
      >
        <Ionicons name="add" size={15} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
