# SaveBite offline mode

## 1. Install (app)
    npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo expo-image expo-secure-store expo-crypto expo-local-authentication
app.json -> expo.plugins, add:
    ["expo-local-authentication", { "faceIDPermission": "Allow SaveBite to use Face ID to unlock the app." }]
If you use a development build, rebuild it (these are native modules). Expo Go already includes them.

## 2. Root layout (src/app/_layout.jsx): provider order matters
```jsx
import { SyncProvider } from "../context/SyncContext";
import { CartProvider } from "../context/CartContext";
import { SocketProvider } from "../context/SocketContext";
import AppLockGate from "../components/AppLockGate";
import OfflineBanner from "../components/OfflineBanner";

<AuthProvider>
  <SyncProvider>            {/* needs the user; sends queued changes when online */}
    <CartProvider>          {/* needs SyncProvider */}
      <SocketProvider>
        <AppLockGate>       {/* PIN / fingerprint screen */}
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
            <OfflineBanner />
          </View>
        </AppLockGate>
      </SocketProvider>
    </CartProvider>
  </SyncProvider>
</AuthProvider>
```

## 3. Server
Nothing to install. New: models/IdempotencyKey.js, middleware/idempotency.js (already mounted in every router),
PUT /cart/lines, POST /chat/messages, and like/save/repost/follow now accept { value: true|false }.
Copy the updated controllers/routes/services from the zip.

## 4. How it works
- READS (products, sellers, feed, posts, comments, chats, notifications, saved, addresses, cart, "Deliver to"):
  go through cachedApi(). Online = fresh data, saved on the phone. Offline = the last saved copy.
  Search and filters already run on the phone, so they work on the saved list.
- WRITES (like, save, repost, follow, comment, chat message, post create/edit/delete, cart, profile text,
  mark notifications read): go through mutate(). The screen updates instantly. Offline, the change is saved
  in the outbox and sent in order when the network returns (also when the app opens, and every 30s).
  Each request carries ?idem=<id>, so the server ignores a repeat if the first one already got through.
- Picked photos are uploaded to Cloudinary when the post is actually sent.
- Pictures are cached on the phone's disk (expo-image).
- The pill above the tab bar shows: offline / N changes waiting / syncing / back online.
- Logging out clears the saved data of that account (queued changes stay and upload at next login).

## 5. Sign-in without internet
- A returning user can open the app offline IF the app keeps the session on the phone (see "needs your files" below).
- App lock: 6-digit PIN + optional fingerprint / Face ID (Profile -> PIN & security). Asked on app start and after
  30s in the background. Stored as a salted hash in the phone's secure storage. 5 wrong tries = growing wait,
  10 = must log in again with the password (needs internet).
- A brand-new login, sign-up, OTP, password reset, and wallet / bill payments cannot work offline: they need the
  server (to check the password/OTP, make the account, move money). They show a normal error offline.

## 6. Limits to know
- Nothing is saved until the screen has been opened once while online.
- AsyncStorage holds about 6 MB on Android. Fine for lists of products and posts; if it grows, move to SQLite.
- A photo picked offline must still exist on the phone when the post is sent (the OS can clear its cache).
- Address changes and changing your profile PHOTO need internet (everything else on the profile works offline).
- If two phones change the same thing offline, the one that syncs last wins.
