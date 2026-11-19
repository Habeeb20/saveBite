// app/products/_layout.jsx
import { Stack } from "expo-router";

export default function ProductsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#111",
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ title: "My products" }} />
      <Stack.Screen name="create" options={{ title: "New product" }} />
      <Stack.Screen name="[id]" options={{ title: "Product details" }} />
    </Stack>
  );
}