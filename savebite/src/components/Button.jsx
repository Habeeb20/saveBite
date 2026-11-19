import { Pressable, Text } from "react-native";

const styles = {
  primary: { box: "bg-brand", text: "text-white" },
  outline: { box: "border border-gray-300 bg-white", text: "text-gray-800" },
  ghost: { box: "bg-transparent", text: "text-brand" },
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  className = "",
}) {
  const s = styles[variant] || styles.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-2xl py-4 active:opacity-80 ${s.box} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      <Text className={`text-base font-bold ${s.text}`}>{title}</Text>
    </Pressable>
  );
}
