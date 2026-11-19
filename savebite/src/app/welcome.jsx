import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const features = [
  {
    icon: "storefront-outline",
    title: "Discover food sellers",
    text: "Foodstuff traders, provisions and cooked food near you.",
    bg: "bg-brand-tint",
    color: "#F97316",
  },
  {
    icon: "pricetags-outline",
    title: "Compare prices",
    text: "See who sells what, at what price, and get alerts on drops.",
    bg: "bg-brand-tint",
    color: "#F97316",
  },
  {
    icon: "chatbubbles-outline",
    title: "Chat directly",
    text: "Talk to sellers, ask about stock and agree on delivery.",
    bg: "bg-brand-tint",
    color: "#F97316",
  },
  {
    icon: "wallet-outline",
    title: "Save with ajo",
    text: "Set a food goal and save toward it a little at a time.",
    bg: "bg-money-tint",
    color: "#16A34A",
  },
];

export default function Welcome() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-cream">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <View className="rounded-b-[40px] bg-brand px-6 pb-10 pt-20">
          <View className="items-center">
            <View className="rounded-[30px] border-4 border-white shadow-lg">
              <Image
                source={require("../../assets/images/savebite-icon.png")}
                className="h-24 w-24 rounded-3xl"
                resizeMode="contain"
              />
            </View>
            <Text className="mt-6 text-center text-4xl font-extrabold text-white">
              Eat well.{"\n"}Save more.
            </Text>
            <Text className="mt-3 text-center text-base text-white/90">
              Find food sellers, compare prices and build your food savings, all
              in one app.
            </Text>
          </View>
        </View>

        {/* Features */}
        <View className="px-6 pt-8">
          {features.map((f) => (
            <View
              key={f.title}
              className="mb-3 flex-row items-center rounded-2xl bg-white p-4 shadow-sm"
            >
              <View
                className={`h-12 w-12 items-center justify-center rounded-xl ${f.bg}`}
              >
                <Ionicons name={f.icon} size={24} color={f.color} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-gray-800">
                  {f.title}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500">{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Buttons */}
      <SafeAreaView edges={["bottom"]} className="bg-cream px-6 pb-2 pt-3">
        <Pressable
          onPress={() => router.push("/register")}
          className="items-center rounded-2xl bg-brand py-4 active:opacity-80"
        >
          <Text className="text-lg font-bold text-white">Get Started</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/login")}
          className="mt-3 items-center rounded-2xl border border-gray-300 bg-white py-4 active:opacity-80"
        >
          <Text className="text-base font-semibold text-gray-800">
            I already have an account
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}