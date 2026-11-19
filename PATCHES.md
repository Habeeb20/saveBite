# Small edits to files you already have

## 0. Install (app)
    npx expo install socket.io-client expo-notifications expo-device expo-constants
Add to app.json -> expo.plugins:  "expo-notifications"
Add to .env:  EXPO_PUBLIC_API_URL=https://your-server.com/api   (Socket.IO connects to the same host without /api;
set EXPO_PUBLIC_SOCKET_URL only if it differs)
Remote push needs a development build (not Expo Go) and an EAS projectId in app.json (expo.extra.eas.projectId).

## 1. src/app/_layout.jsx  (root layout)  - wrap the app so every screen can use sockets
```jsx
import { SocketProvider } from "../context/SocketContext";
// inside the return, directly under <AuthProvider> (it needs useAuth):
<AuthProvider>
  <SocketProvider>
    ...your existing providers / <Stack /> ...
  </SocketProvider>
</AuthProvider>
```
SocketProvider reads `token` and `user` from useAuth(). If your AuthContext exposes the JWT under another name, change that one line.

## 2. src/app/(tabs)/dashboard.jsx  - post + manage-posts buttons
In SellerView, replace the "Shop tools" <ActionRow> with:
```jsx
<ActionRow
  actions={[
    { label: "New product", icon: "add-circle-outline", onPress: () => router.push("/products/create") },
    { label: "My products", icon: "cube-outline", onPress: () => router.push("/products") },
    { label: "New post", icon: "images-outline", onPress: () => router.push("/posts/create") },
    { label: "Messages", icon: "chatbubbles-outline", onPress: () => router.push("/chat") },
  ]}
/>
<View className="mt-3">
  <ActionRow
    actions={[
      { label: "My posts", icon: "albums-outline", onPress: () => router.push("/posts/manage") },
      { label: "Community", icon: "people-outline", onPress: () => router.push("/feed") },
    ]}
  />
</View>
```
In BuyerView, add this section after "Quick pay":
```jsx
<Section title="Community">
  <ActionRow
    actions={[
      { label: "New request", icon: "megaphone-outline", onPress: () => router.push("/posts/create") },
      { label: "My posts", icon: "albums-outline", onPress: () => router.push("/posts/manage") },
      { label: "Messages", icon: "chatbubbles-outline", onPress: () => router.push("/chat") },
      { label: "Saved", icon: "bookmark-outline", onPress: () => router.push("/account/saved") },
    ]}
  />
</Section>
```
The seller "Followers" and "Posts" tiles and the buyer "Sellers followed" / "Saved posts" tiles are already
reading me.seller.followersCount, me.seller.postsCount, me.buyer.following and me.buyer.savedPosts -
the new backend keeps exactly those fields up to date, so they become real numbers.

## 3. src/app/(tabs)/home.jsx  - notification bell
```jsx
import { useSocket } from "../../context/SocketContext";
// in Home():  const { unread } = useSocket();
<Pressable onPress={() => router.push("/notifications")} className="h-11 w-11 items-center justify-center rounded-full bg-white">
  <Ionicons name="notifications-outline" size={22} color="#1F2937" />
  {unread.notifications > 0 ? <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand" /> : null}
</Pressable>
```

## 4. Cart
The backend cart is ready (GET/DELETE /cart, POST /cart/items, PATCH|DELETE /cart/items/:itemId, PATCH /cart/options, POST /cart/merge).
Your app's CartContext is still in-memory, so it is not talking to it yet. I did not change it because I haven't seen the file.
After login you can push the local cart up once with:
    api("/cart/merge", { method: "POST", auth: true, body: { items: [{ productId, quantity }] } })

## 5. Cart (new files, nothing to merge)
Files: src/context/CartContext.jsx, src/components/QtyStepper.jsx, src/app/(tabs)/cart.jsx
Wrap the app with CartProvider inside AuthProvider (root _layout.jsx):
```jsx
<AuthProvider>
  <CartProvider>
    <SocketProvider>
      ...
    </SocketProvider>
  </CartProvider>
</AuthProvider>
```
import { CartProvider } from "../context/CartContext";
Optional badge on the cart tab in (tabs)/_layout.jsx:  const { itemCount } = useCart();  then on the cart screen
options={{ tabBarBadge: itemCount || undefined }}
Home already calls useCart() (qtyOf, add, setQty) and QtyStepper, so it works as is.
