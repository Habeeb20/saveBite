// import { Redirect, Tabs } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useAuth } from "../../context/AuthContext";
// import { CartProvider, useCart } from "../../context/CartContext";

// const icon =
//   (on, off) =>
//   ({ color, size, focused }) =>
//     <Ionicons name={focused ? on : off} size={size} color={color} />;

// function MainTabs() {
//   const { count } = useCart();

//   return (
//     <Tabs
//       initialRouteName="home"
//       screenOptions={{
//         headerShown: false,
//         tabBarActiveTintColor: "#F97316",
//         tabBarInactiveTintColor: "#9CA3AF",
//         tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
//         tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#F3F4F6" },
//       }}
//     >
//       <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
//       <Tabs.Screen name="feed" options={{ title: "Community", tabBarIcon: icon("people", "people-outline") }} />
//       <Tabs.Screen
//         name="cart"
//         options={{
//           title: "Cart",
//           tabBarIcon: icon("cart", "cart-outline"),
//           tabBarBadge: count > 0 ? count : undefined,
//           tabBarBadgeStyle: { backgroundColor: "#F97316", color: "#FFFFFF", fontSize: 10 },
//         }}
//       />
//       <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: icon("wallet", "wallet-outline") }} />
//       <Tabs.Screen name="profile" options={{ title: "Me", tabBarIcon: icon("person", "person-outline") }} />
//     </Tabs>
//   );
// }

// export default function TabsLayout() {
//   const { user, booting } = useAuth();

//   if (booting) return null;
//   // Logging out (or an expired session) sends the user back to the start screen
//   if (!user) return <Redirect href="/welcome" />;

//   return (
//     <CartProvider>
//       <MainTabs />
//     </CartProvider>
//   );
// }



import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { CartProvider, useCart } from "../../context/CartContext";

const icon =
  (on, off) =>
  ({ color, size, focused }) =>
    <Ionicons name={focused ? on : off} size={size} color={color} />;

function MainTabs() {
  const { count } = useCart();
  const { user } = useAuth();

  // Keep the bar at five tabs for sellers and riders: the cart is for people shopping.
  const showCart = (user?.activeRole || "buyer") === "buyer";

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F97316",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#F3F4F6" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="feed" options={{ title: "Community", tabBarIcon: icon("people", "people-outline") }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          href: showCart ? undefined : null, // null hides the tab (the screen still exists)
          tabBarIcon: icon("cart", "cart-outline"),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: "#F97316", color: "#FFFFFF", fontSize: 10 },
        }}
      />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: icon("grid", "grid-outline") }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: icon("wallet", "wallet-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Me", tabBarIcon: icon("person", "person-outline") }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { user, booting } = useAuth();

  if (booting) return null;
  // Logging out (or an expired session) sends the user back to the start screen
  if (!user) return <Redirect href="/welcome" />;

  return (
    <CartProvider>
      <MainTabs />
    </CartProvider>
  );
}