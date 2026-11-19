import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

// Four boxes driven by one hidden input, so typing, deleting and pasting all work.
export default function OtpInput({ value, onChange, length = 4, error, autoFocus = true }) {
  const inputRef = useRef(null);

  return (
    <View>
      <View className="relative">
        <Pressable onPress={() => inputRef.current?.focus()} className="-mx-1.5 flex-row">
          {Array.from({ length }).map((_, i) => {
            const char = value[i] || "";
            const active = i === Math.min(value.length, length - 1);
            const border = error
              ? "border-red-500"
              : active
              ? "border-brand"
              : char
              ? "border-gray-400"
              : "border-gray-200";
            return (
              <View
                key={i}
                className={`mx-1.5 h-16 flex-1 items-center justify-center rounded-2xl border-2 bg-white ${border}`}
              >
                <Text className="text-3xl font-bold text-gray-900">{char}</Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={length}
          autoFocus={autoFocus}
          caretHidden
          style={[StyleSheet.absoluteFill, { opacity: 0.02 }]}
        />
      </View>

      {error ? <Text className="mt-2 text-center text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
