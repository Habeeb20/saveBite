//   // src/app/_layout.jsx
//   import { Slot } from "expo-router";
//   import { AuthProvider } from "../context/AuthContext";
// import { CartProvider } from "../context/CartContext";
// import { SocketProvider } from "../context/SocketContext";
//   export default function RootLayout() {
//     return (
//       <AuthProvider>
//         <SocketProvider>
//                 <CartProvider>
//             <Slot />
//         </CartProvider>
//         </SocketProvider>
    
      
//       </AuthProvider>
//     );
//   }







// src/app/_layout.jsx
import { View } from "react-native";
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import { CartProvider } from "../context/CartContext";
import { SocketProvider } from "../context/SocketContext";
import AppLockGate from "../components/AppLockGate";
import OfflineBanner from "../components/OfflineBanner";

export default function RootLayout() {
  return (
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
  );
}