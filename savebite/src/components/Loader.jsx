import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Modal, Text, View } from "react-native";

/**
 * SaveBite loader: the app icon grows and fades, then shrinks and fades back, on repeat.
 *
 * <Loader visible={loading} message="Verifying..." />        full-screen overlay
 * <Loader overlay={false} size={48} />                        inline (inside a card or list)
 */
export default function Loader({ visible = true, message, size = 88, overlay = true }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return undefined;

    scale.setValue(1);
    opacity.setValue(1);

    const loop = Animated.loop(
      Animated.sequence([
        // 1) increase + fade out
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 0.15, duration: 650, useNativeDriver: true }),
        ]),
        // 2) decrease + fade back in
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
        // 3) settle back to normal size
        Animated.timing(scale, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, scale, opacity]);

  if (!visible) return null;

  const icon = (
    <View className="items-center justify-center">
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={require("../../assets/images/savebite-icon.png")}
          style={{ width: size, height: size, borderRadius: size * 0.24 }}
          resizeMode="contain"
        />
      </Animated.View>
      {message ? (
        <Text className="mt-6 text-center text-base font-medium text-gray-700">{message}</Text>
      ) : null}
    </View>
  );

  if (!overlay) return icon;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center bg-cream/90">{icon}</View>
    </Modal>
  );
}
