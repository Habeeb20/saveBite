import { useEffect, useRef } from "react";
import { View, Text, Image, Animated } from "react-native";
import { useRouter } from "expo-router";

export default function Splash() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => router.replace("/welcome"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-cream">
      <Animated.View
        style={{ opacity: fade, transform: [{ scale }], alignItems: "center" }}
      >
        <Image
          source={require("../../assets/images/savebite-icon.png")}
          className="h-28 w-28 rounded-3xl"
          resizeMode="contain"
        />
        <Text className="mt-6 text-3xl font-bold text-brand">
          Save<Text className="text-gray-800">Bite</Text>
        </Text>
        <Text className="mt-2 text-money">Eat well. Save more.</Text>
      </Animated.View>
    </View>
  );
}