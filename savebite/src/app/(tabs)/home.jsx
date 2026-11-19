

// import { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   ActivityIndicator,
//   FlatList,
//   Image,
//   Pressable,
//   RefreshControl,
//   ScrollView,
//   Text,
//   TextInput,
//   View,
//   useWindowDimensions,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { Ionicons } from "@expo/vector-icons";
// import { useRouter } from "expo-router";
// import WalletCard from "../../components/WalletCard";
// import QtyStepper from "../../components/QtyStepper";
// import { useAuth } from "../../context/AuthContext";
// import { useCart } from "../../context/CartContext";
// import { useMe } from "../../lib/useMe";
// import { POSTS, formatNaira, sellerOf } from "../../lib/mockData"; // POSTS: community feed is still mock
// import { RADIUS_KM, formatKm } from "../../lib/geo";
// import { matchesProduct, rankSellers, tokenize, useMarket } from "../../lib/market";
// import { useUserLocation } from "../../lib/useUserLocation";
// import { useSocket } from "../../context/SocketContext";

// // ids must match the categories used when creating a product
// const CATEGORIES = [
//   { id: "all", label: "All", emoji: "✨" },
//   { id: "grains", label: "Grains", emoji: "🌾" },
//   { id: "tubers", label: "Tubers", emoji: "🍠" },
//   { id: "vegetables", label: "Vegetables", emoji: "🥬" },
//   { id: "fruits", label: "Fruits", emoji: "🍎" },
//   { id: "meat", label: "Meat", emoji: "🥩" },
//   { id: "fish", label: "Fish", emoji: "🐟" },
//   { id: "poultry", label: "Poultry", emoji: "🍗" },
//   { id: "oils", label: "Oils", emoji: "🫒" },
//   { id: "spices", label: "Spices", emoji: "🌶️" },
//   { id: "cooked meals", label: "Cooked meals", emoji: "🍲" },
//   { id: "snacks", label: "Snacks", emoji: "🍿" },
//   { id: "drinks", label: "Drinks", emoji: "🥤" },
//   { id: "other", label: "Other", emoji: "🛒" },
// ];

// const greeting = () => {
//   const h = new Date().getHours();
//   return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
// };

// function useDebounced(value, delay = 350) {
//   const [v, setV] = useState(value);
//   useEffect(() => {
//     const t = setTimeout(() => setV(value), delay);
//     return () => clearTimeout(t);
//   }, [value, delay]);
//   return v;
// }

// /* ----------------------------- pieces ----------------------------- */

// function SectionHeader({ title, action, onAction }) {
//   return (
//     <View className="mb-3 mt-7 flex-row items-end justify-between px-6">
//       <Text className="text-xl font-extrabold text-gray-900">{title}</Text>
//       {action ? (
//         <Pressable onPress={onAction} hitSlop={8}>
//           <Text className="text-sm font-semibold text-brand">{action}</Text>
//         </Pressable>
//       ) : null}
//     </View>
//   );
// }

// function ProductCard({ product, width }) {
//   console.log(product)
//   const { qtyOf, add, setQty } = useCart();
//   const qty = qtyOf(product.id);
//   const soldOut = product.stock === 0;
//   const off = product.old && product.old > product.price ? Math.round((1 - product.price / product.old) * 100) : 0;

//   return (
//     <View style={{ width }} className="rounded-3xl bg-white p-3">
//       <View
//         style={{ backgroundColor: product.tint }}
//         className="h-28 items-center justify-center overflow-hidden rounded-2xl"
//       >
//         {product.image ? (
//           <Image source={{ uri: product.image }} resizeMode="cover" className="h-28 w-full" />
//         ) : (
//           <Text style={{ fontSize: 52 }}>{product.emoji}</Text>
//         )}
//         {off > 0 ? (
//           <View className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5">
//             <Text className="text-xs font-bold text-white">-{off}%</Text>
//           </View>
//         ) : null}
//       </View>

//       <Text numberOfLines={2} className="mt-3 text-sm font-extrabold text-gray-900" style={{ minHeight: 36 }}>
//         {product.name}
//       </Text>
//       <Text numberOfLines={1} className=" text-xs font-bold text-gray-500">
//         {product?.shopName}
//       </Text>
//       <Text numberOfLines={1} className="mt-0.5 text-xs text-gray-500">
//         {product.sellerName}
//       </Text>

//       <View className="mt-2 flex-row items-baseline">
//         <Text className="text-base font-extrabold text-gray-900">{formatNaira(product.price)}</Text>
//         {off > 0 ? (
//           <Text className="ml-2 text-xs text-gray-400 line-through">{formatNaira(product.old)}</Text>
//         ) : null}
//       </View>

//       <View className="mt-3">
//         {soldOut ? (
//           <View className="h-9 items-center justify-center rounded-full bg-gray-100">
//             <Text className="text-sm font-bold text-gray-400">Sold out</Text>
//           </View>
//         ) : qty === 0 ? (
//           <Pressable
//             onPress={() => add(product)}
//             className="h-9 flex-row items-center justify-center rounded-full bg-brand"
//           >
//             <Ionicons name="add" size={18} color="#FFFFFF" />
//             <Text className="ml-1 text-sm font-bold text-white">Add</Text>
//           </Pressable>
//         ) : (
//           <QtyStepper qty={qty} onChange={(n) => setQty(product.id, n)} />
//         )}
//       </View>
//     </View>
//   );
// }

// // Defined outside Home so it isn't re-created (and re-mounted) on every keystroke in the search box
// function Grid({ data, width }) {
//   return (
//     <View className="flex-row flex-wrap justify-between px-6">
//       {data.map((p) => (
//         <View key={p.id} style={{ marginBottom: 12 }}>
//           <ProductCard product={p} width={width} />
//         </View>
//       ))}
//     </View>
//   );
// }

// function Notice({ emoji, title, body, action, onAction }) {
//   return (
//     <View className="items-center px-10 py-10">
//       <Text style={{ fontSize: 40 }}>{emoji}</Text>
//       <Text className="mt-3 text-base font-semibold text-gray-900">{title}</Text>
//       {body ? <Text className="mt-1 text-center text-sm text-gray-500">{body}</Text> : null}
//       {action ? (
//         <Pressable onPress={onAction} className="mt-4 rounded-full bg-brand px-5 py-2.5">
//           <Text className="text-sm font-bold text-white">{action}</Text>
//         </Pressable>
//       ) : null}
//     </View>
//   );
// }

// function LocationNotice({ status, onEnable }) {
//   if (status === "idle" || status === "loading") {
//     return (
//       <View className="mx-6 flex-row items-center rounded-2xl bg-white p-4">
//         <ActivityIndicator color="#F97316" />
//         <Text className="ml-3 text-sm text-gray-500">Finding sellers near you...</Text>
//       </View>
//     );
//   }
//   const copy =
//     status === "denied"
//       ? "Allow location access to see sellers close to you."
//       : status === "disabled"
//       ? "Location is switched off on your phone."
//       : "We couldn't get your location.";
//   return (
//     <View className="mx-6 flex-row items-center rounded-2xl bg-white p-4">
//       <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
//         <Ionicons name="location-outline" size={20} color="#F97316" />
//       </View>
//       <Text className="ml-3 flex-1 text-sm text-gray-700">{copy}</Text>
//       <Pressable onPress={onEnable} className="ml-2 rounded-full bg-brand px-4 py-2">
//         <Text className="text-xs font-bold text-white">{status === "error" ? "Retry" : "Turn on"}</Text>
//       </Pressable>
//     </View>
//   );
// }

// /* ----------------------------- screen ----------------------------- */

// export default function Home() {
//   const router = useRouter();
//   const { user } = useAuth();
//   const { me, loading: meLoading, refreshing, refresh } = useMe();
//   const { width } = useWindowDimensions();
// const {unread} = useSocket() 
//   const [query, setQuery] = useState("");
//   const [category, setCategory] = useState("all");
//   const [pulling, setPulling] = useState(false);

//   const q = query.trim().toLowerCase();
//   const debouncedQ = useDebounced(q);
//   const filtering = category !== "all" || q.length > 0;

//   const { products, sellers, loading, error, reload } = useMarket({ search: debouncedQ, category });
//   const { coords, place, nearby, status: locStatus, locate, enable } = useUserLocation();

//   const gridWidth = (width - 48 - 12) / 2;

//   // Instant client-side filtering on top of the (debounced) server search,
//   // so typing feels immediate and still works if the server ignores ?search=
//   const tokens = useMemo(() => tokenize(q), [q]);
//   const results = useMemo(
//     () => products.filter((p) => matchesProduct(p, tokens, category)),
//     [products, tokens, category]
//   );
//   const searching = loading || debouncedQ !== q;

//   const deals = useMemo(() => products.filter((p) => p.old && p.old > p.price), [products]);
//   const nearSellers = useMemo(
//     () => rankSellers(sellers, coords, nearby, place),
//     [sellers, coords, nearby, place]
//   );
//   const placeLabel = [place?.lga, place?.state].filter(Boolean).join(", ");

//   const onRefresh = useCallback(async () => {
//     setPulling(true);
//     await Promise.allSettled([refresh(), reload(), locate({ prompt: false })]);
//     setPulling(false);
//   }, [refresh, reload, locate]);

//   const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "SB";

//   return (
//     <SafeAreaView edges={["top"]} className="flex-1 bg-cream">


      
//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//         keyboardDismissMode="on-drag"
//         contentContainerStyle={{ paddingBottom: 32 }}
//         refreshControl={
//           <RefreshControl refreshing={refreshing || pulling} onRefresh={onRefresh} tintColor="#F97316" />
//         }
//       >

// <Pressable onPress={() => router.push("/notifications")} className="h-11 w-11 items-center justify-center rounded-full bg-white">
//   <Ionicons name="notifications-outline" size={22} color="#1F2937" />
//   {unread.notifications > 0 ? <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand" /> : null}
// </Pressable>
//         {/* header */}
//         <View className="flex-row items-center px-6 pb-4 pt-2">
//           <Pressable
//             onPress={() => router.push("/profile")}
//             className="h-12 w-12 items-center justify-center rounded-full bg-brand-tint"
//           >
//             <Text className="text-base font-extrabold text-brand">{initials}</Text>
//           </Pressable>
//           <View className="ml-3 flex-1">
//             <Text className="text-sm text-gray-500">{greeting()}</Text>
//             <Text numberOfLines={1} className="text-xl font-extrabold text-gray-900">
//               {user?.firstName || "there"}
//             </Text>
//           </View>
//           <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-white">
//             <Ionicons name="notifications-outline" size={22} color="#1F2937" />
//             <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand" />
//           </Pressable>
//         </View>

//         {/* search */}
//         <View className="mx-6 flex-row items-center rounded-2xl bg-white px-4" style={{ height: 52 }}>
//           <Ionicons name="search-outline" size={20} color="#9CA3AF" />
//           <TextInput
//             value={query}
//             onChangeText={setQuery}
//             placeholder="Search food, sellers or ingredients"
//             placeholderTextColor="#9CA3AF"
//             className="ml-3 flex-1 text-base text-gray-900"
//             returnKeyType="search"
//             autoCorrect={false}
//             autoCapitalize="none"
//           />
//           {searching && q ? <ActivityIndicator size="small" color="#F97316" style={{ marginRight: 8 }} /> : null}
//           {query ? (
//             <Pressable onPress={() => setQuery("")} hitSlop={10}>
//               <Ionicons name="close-circle" size={18} color="#9CA3AF" />
//             </Pressable>
//           ) : null}
//         </View>

//         {/* wallet */}
//         {!filtering ? (
//           <View className="mx-6 mt-5">
//             <WalletCard
//               balance={me?.wallet?.balance ?? 0}
//               loading={meLoading}
//               onPress={() => router.push("/wallet")}
//               actions={[{ icon: "add", label: "Add money", onPress: () => router.push("/wallet") }]}
//             />
//           </View>
//         ) : null}

//         {/* categories */}
//         <FlatList
//           horizontal
//           data={CATEGORIES}
//           keyExtractor={(c) => c.id}
//           showsHorizontalScrollIndicator={false}
//           className="mt-6"
//           contentContainerStyle={{ paddingHorizontal: 24 }}
//           ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
//           renderItem={({ item }) => {
//             const on = category === item.id;
//             return (
//               <Pressable
//                 onPress={() => setCategory(item.id)}
//                 className={`flex-row items-center rounded-full border px-4 py-2.5 ${
//                   on ? "border-brand bg-brand" : "border-gray-200 bg-white"
//                 }`}
//               >
//                 <Text className="mr-1.5 text-base">{item.emoji}</Text>
//                 <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-700"}`}>
//                   {item.label}
//                 </Text>
//               </Pressable>
//             );
//           }}
//         />

//         {error && !products.length ? (
//           <Notice
//             emoji="📡"
//             title="Couldn't load products"
//             body={error}
//             action="Try again"
//             onAction={reload}
//           />
//         ) : filtering ? (
//           <>
//             <SectionHeader
//               title={searching && !results.length ? "Searching..." : `${results.length} result${results.length === 1 ? "" : "s"}`}
//             />
//             {results.length ? (
//               <Grid data={results} width={gridWidth} />
//             ) : searching ? (
//               <View className="items-center py-12">
//                 <ActivityIndicator color="#F97316" />
//               </View>
//             ) : (
//               <Notice
//                 emoji="🔎"
//                 title="Nothing matches yet"
//                 body="Try another word or pick a different category."
//               />
//             )}
//           </>
//         ) : loading && !products.length ? (
//           <View className="items-center py-16">
//             <ActivityIndicator color="#F97316" />
//           </View>
//         ) : (
//           <>
//             {deals.length ? (
//               <>
//                 <SectionHeader title="Price drops" action="See all" onAction={() => setCategory("all")} />
//                 <FlatList
//                   horizontal
//                   data={deals}
//                   keyExtractor={(p) => p.id}
//                   showsHorizontalScrollIndicator={false}
//                   contentContainerStyle={{ paddingHorizontal: 24 }}
//                   ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
//                   renderItem={({ item }) => <ProductCard product={item} width={176} />}
//                 />
//               </>
//             ) : null}

//             <SectionHeader title="Sellers near you" />
//             {locStatus !== "granted" ? (
//               <LocationNotice status={locStatus} onEnable={enable} />
//             ) : nearSellers.length ? (
//               <>
//                 {placeLabel ? (
//                   <View className="-mt-1 mb-3 flex-row items-center px-6">
//                     <Ionicons name="location" size={13} color="#F97316" />
//                     <Text className="ml-1 text-xs text-gray-500">{placeLabel}</Text>
//                   </View>
//                 ) : null}
//                 <FlatList
//                   horizontal
//                   data={nearSellers}
//                   keyExtractor={(s) => s.id}
//                   showsHorizontalScrollIndicator={false}
//                   contentContainerStyle={{ paddingHorizontal: 24 }}
//                   ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
//                   renderItem={({ item }) => (
//                     <Pressable onPress={() => setQuery(item.name)} className="items-center" style={{ width: 84 }}>
//                       {item.avatar ? (
//                         <Image source={{ uri: item.avatar }} className="h-16 w-16 rounded-full bg-gray-200" />
//                       ) : (
//                         <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
//                           <Text style={{ fontSize: 28 }}>🏪</Text>
//                         </View>
//                       )}
//                       <Text numberOfLines={2} className="mt-2 text-center text-xs font-semibold text-gray-900">
//                         {item.name}
//                       </Text>
//                       <View className="mt-0.5 flex-row items-center">
//                         {item.rating ? (
//                           <>
//                             <Ionicons name="star" size={11} color="#F59E0B" />
//                             <Text className="ml-1 mr-1.5 text-xs text-gray-500">{item.rating}</Text>
//                           </>
//                         ) : null}
//                         <Text className="text-xs text-gray-500">{formatKm(item.km, item.approx)}</Text>
//                       </View>
//                     </Pressable>
//                   )}
//                 />
//               </>
//             ) : (
//               <View className="mx-6 rounded-2xl bg-white p-4">
//                 <Text className="text-sm text-gray-500">
//                   {placeLabel ? `No sellers within ${RADIUS_KM} km of ${placeLabel} yet.` : `No sellers within ${RADIUS_KM} km yet.`}
//                 </Text>
//               </View>
//             )}

//             <SectionHeader title="Popular right now" />
//             {products.length ? (
//               <Grid data={products.slice(0, 6)} width={gridWidth} />
//             ) : (
//               <Notice emoji="🛒" title="No products yet" body="Check back soon, sellers are adding stock." />
//             )}

//             <SectionHeader title="From the community" action="Open feed" onAction={() => router.push("/feed")} />
//             <View className="px-6">
//               {POSTS.slice(0, 2).map((post) => {
//                 const seller = sellerOf(post.seller);
//                 return (
//                   <Pressable
//                     key={post.id}
//                     onPress={() => router.push("/feed")}
//                     className="mb-3 flex-row items-center rounded-3xl bg-white p-3"
//                   >
//                     <View
//                       style={{ backgroundColor: post.tint }}
//                       className="h-16 w-16 items-center justify-center rounded-2xl"
//                     >
//                       <Text style={{ fontSize: 30 }}>{post.emoji}</Text>
//                     </View>
//                     <View className="ml-3 flex-1">
//                       <Text className="text-sm font-bold text-gray-900">{seller?.name}</Text>
//                       <Text numberOfLines={2} className="mt-0.5 text-sm text-gray-500">
//                         {post.text}
//                       </Text>
//                     </View>
//                     <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
//                   </Pressable>
//                 );
//               })}
//             </View>
//           </>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }





import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import WalletCard from "../../components/WalletCard";
import QtyStepper from "../../components/QtyStepper";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useSocket } from "../../context/SocketContext";
import { useMe } from "../../lib/useMe";
import { formatNaira } from "../../lib/mockData";
import { RADIUS_KM, formatKm } from "../../lib/geo";
import { matchesProduct, rankSellers, tokenize, useMarket } from "../../lib/market";
import { useUserLocation } from "../../lib/useUserLocation";
import { useCommunity } from "../../lib/useCommunity";

// ids must match the categories used when creating a product
const CATEGORIES = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "grains", label: "Grains", emoji: "🌾" },
  { id: "tubers", label: "Tubers", emoji: "🍠" },
  { id: "vegetables", label: "Vegetables", emoji: "🥬" },
  { id: "fruits", label: "Fruits", emoji: "🍎" },
  { id: "meat", label: "Meat", emoji: "🥩" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "poultry", label: "Poultry", emoji: "🍗" },
  { id: "oils", label: "Oils", emoji: "🫒" },
  { id: "spices", label: "Spices", emoji: "🌶️" },
  { id: "cooked meals", label: "Cooked meals", emoji: "🍲" },
  { id: "snacks", label: "Snacks", emoji: "🍿" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
  { id: "other", label: "Other", emoji: "🛒" },
];

const POST_EMOJI = { stock: "🥬", menu: "🍲", wanted: "🔎" };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const pctOff = (p) => (p.old && p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0);

/* ----------------------------- pieces ----------------------------- */

function SectionHeader({ title, action, onAction }) {
  return (
    <View className="mb-3 mt-7 flex-row items-end justify-between px-6">
      <Text className="text-xl font-extrabold text-gray-900">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Big photo with a round "+" on the picture (it becomes a stepper once the item is in the cart)
function ProductCard({ product, width }) {
  const { qtyOf, add, setQty } = useCart();
  const qty = qtyOf(product.id);
  const soldOut = product.stock === 0;
  const off = pctOff(product);

  return (
    <View style={{ width }} className="rounded-3xl bg-white p-2.5">
      <View
        style={{ backgroundColor: product.tint }}
        className="h-32 items-center justify-center overflow-hidden rounded-2xl"
      >
        {product.image ? (
          <Image source={{ uri: product.image }} resizeMode="cover" className="h-32 w-full" />
        ) : (
          <Text style={{ fontSize: 52 }}>{product.emoji}</Text>
        )}
        {off > 0 ? (
          <View className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5">
            <Text className="text-xs font-bold text-white">-{off}%</Text>
          </View>
        ) : null}
        {soldOut ? (
          <View className="absolute inset-0 items-center justify-center bg-white/70">
            <Text className="text-sm font-extrabold text-gray-500">Sold out</Text>
          </View>
        ) : qty === 0 ? (
          <Pressable
            onPress={() => add(product)}
            style={{ position: "absolute", right: 8, bottom: 8 }}
            className="h-9 w-9 items-center justify-center rounded-full bg-white shadow"
          >
            <Ionicons name="add" size={22} color="#F97316" />
          </Pressable>
        ) : (
          <View style={{ position: "absolute", right: 6, bottom: 6, width: 104 }}>
            <QtyStepper small qty={qty} onChange={(n) => setQty(product.id, n)} />
          </View>
        )}
      </View>

      <Text numberOfLines={2} className="mt-2.5 text-sm font-extrabold text-gray-900" style={{ minHeight: 36 }}>
        {product.name}
      </Text>
      {product?.shopName ? (
        <Text numberOfLines={1} className="text-xs font-bold text-gray-500">
          {product.shopName}
        </Text>
      ) : null}
      {product.sellerName ? (
        <View className="mt-0.5 flex-row items-center">
          <Ionicons name="storefront-outline" size={11} color="#9CA3AF" />
          <Text numberOfLines={1} className="ml-1 flex-1 text-xs text-gray-500">
            {product.sellerName}
          </Text>
        </View>
      ) : null}

      <View className="mt-1.5 flex-row items-baseline">
        <Text className="text-base font-extrabold text-gray-900">{formatNaira(product.price)}</Text>
        {off > 0 ? (
          <Text className="ml-2 text-xs text-gray-400 line-through">{formatNaira(product.old)}</Text>
        ) : null}
      </View>
    </View>
  );
}

// Defined outside Home so it isn't re-created (and re-mounted) on every keystroke in the search box
function Grid({ data, width }) {
  return (
    <View className="flex-row flex-wrap justify-between px-6">
      {data.map((p) => (
        <View key={p.id} style={{ marginBottom: 12 }}>
          <ProductCard product={p} width={width} />
        </View>
      ))}
    </View>
  );
}

// grey placeholder cards while products load (feels faster than a spinner)
function SkeletonGrid({ width }) {
  return (
    <View className="mt-7 flex-row flex-wrap justify-between px-6">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width, marginBottom: 12 }} className="rounded-3xl bg-white p-2.5">
          <View className="h-32 rounded-2xl bg-gray-100" />
          <View className="mt-3 h-3 w-3/4 rounded bg-gray-100" />
          <View className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
          <View className="mt-3 h-4 w-1/3 rounded bg-gray-100" />
        </View>
      ))}
    </View>
  );
}

function Notice({ emoji, title, body, action, onAction }) {
  return (
    <View className="items-center px-10 py-10">
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <Text className="mt-3 text-base font-semibold text-gray-900">{title}</Text>
      {body ? <Text className="mt-1 text-center text-sm text-gray-500">{body}</Text> : null}
      {action ? (
        <Pressable onPress={onAction} className="mt-4 rounded-full bg-brand px-5 py-2.5">
          <Text className="text-sm font-bold text-white">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LocationNotice({ status, onEnable }) {
  if (status === "idle" || status === "loading") {
    return (
      <View className="mx-6 flex-row items-center rounded-2xl bg-white p-4">
        <ActivityIndicator color="#F97316" />
        <Text className="ml-3 text-sm text-gray-500">Finding sellers near you...</Text>
      </View>
    );
  }
  const copy =
    status === "denied"
      ? "Allow location access to see sellers close to you."
      : status === "disabled"
      ? "Location is switched off on your phone."
      : "We couldn't get your location.";
  return (
    <View className="mx-6 flex-row items-center rounded-2xl bg-white p-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
        <Ionicons name="location-outline" size={20} color="#F97316" />
      </View>
      <Text className="ml-3 flex-1 text-sm text-gray-700">{copy}</Text>
      <Pressable onPress={onEnable} className="ml-2 rounded-full bg-brand px-4 py-2">
        <Text className="text-xs font-bold text-white">{status === "error" ? "Retry" : "Turn on"}</Text>
      </Pressable>
    </View>
  );
}

/* ----------------------------- screen ----------------------------- */

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { me, loading: meLoading, refreshing, refresh } = useMe();
  const { unread, isOnline, watch } = useSocket();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [pulling, setPulling] = useState(false);

  const q = query.trim().toLowerCase();
  const debouncedQ = useDebounced(q);
  const filtering = category !== "all" || q.length > 0;

  const { products, sellers, loading, error, reload } = useMarket({ search: debouncedQ, category });
  const { coords, place, nearby, status: locStatus, locate, enable } = useUserLocation();
  const community = useCommunity(3);

  const gridWidth = (width - 48 - 12) / 2;

  // Instant client-side filtering on top of the (debounced) server search,
  // so typing feels immediate and still works if the server ignores ?search=
  const tokens = useMemo(() => tokenize(q), [q]);
  const results = useMemo(
    () => products.filter((p) => matchesProduct(p, tokens, category)),
    [products, tokens, category]
  );
  const searching = loading || debouncedQ !== q;

  const deals = useMemo(() => products.filter((p) => p.old && p.old > p.price), [products]);
  const bestDeal = useMemo(() => deals.reduce((m, p) => Math.max(m, pctOff(p)), 0), [deals]);

  // products grouped by the category they belong to, in the same order as the category tiles
  const groups = useMemo(() => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    const map = new Map();
    products.forEach((p) => {
      const key = known.has(p.cat) ? p.cat : "other"; // unknown/old categories go under "Other"
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return CATEGORIES.filter((c) => c.id !== "all" && map.has(c.id)).map((c) => ({ ...c, items: map.get(c.id) }));
  }, [products]);
  const nearSellers = useMemo(
    () => rankSellers(sellers, coords, nearby, place),
    [sellers, coords, nearby, place]
  );
  const placeLabel = [place?.lga, place?.state].filter(Boolean).join(", ");
  const locating = locStatus === "idle" || locStatus === "loading";

  // green dot for the people in the community preview
  useEffect(() => {
    watch(community.posts.map((p) => p.author?._id));
  }, [community.posts, watch]);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await Promise.allSettled([refresh(), reload(), community.reload(), locate({ prompt: false })]);
    setPulling(false);
  }, [refresh, reload, community.reload, locate]);

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "SB";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || pulling} onRefresh={onRefresh} tintColor="#F97316" />
        }
      >
        {/* header */}
        <View className="flex-row items-center px-6 pb-3 pt-2">
          <Pressable
            onPress={() => router.push("/profile")}
            className="h-12 w-12 items-center justify-center rounded-full bg-brand-tint"
          >
            <Text className="text-base font-extrabold text-brand">{initials}</Text>
          </Pressable>
          <View className="ml-3 flex-1">
            <Text className="text-sm text-gray-500">{greeting()}</Text>
            <Text numberOfLines={1} className="text-xl font-extrabold text-gray-900">
              {user?.firstName || "there"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/notifications")}
            className="h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <Ionicons name="notifications-outline" size={22} color="#1F2937" />
            {unread.notifications > 0 ? (
              <View className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border border-white bg-brand" />
            ) : null}
          </Pressable>
        </View>

        {/* where you are (like "Deliver to" in food apps) */}
        <Pressable
          onPress={locStatus === "granted" ? undefined : enable}
          className="mx-6 mb-4 flex-row items-center self-start rounded-full bg-white px-3 py-2"
        >
          <Ionicons name="location" size={15} color="#F97316" />
          <Text numberOfLines={1} className="ml-1.5 max-w-[240px] text-sm font-semibold text-gray-800">
            {placeLabel || (locating ? "Locating you..." : "Set your location")}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
        </Pressable>

        {/* wallet (kept at the top) */}
        {!filtering ? (
          <View className="mx-6 mb-5">
            <WalletCard
              balance={me?.wallet?.balance ?? 0}
              loading={meLoading}
              onPress={() => router.push("/wallet")}
              actions={[{ icon: "add", label: "Add money", onPress: () => router.push("/wallet") }]}
            />
          </View>
        ) : null}

        {/* search */}
        <View className="mx-6 flex-row items-center rounded-2xl bg-white px-4" style={{ height: 52 }}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search food, sellers or ingredients"
            placeholderTextColor="#9CA3AF"
            className="ml-3 flex-1 text-base text-gray-900"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searching && q ? <ActivityIndicator size="small" color="#F97316" style={{ marginRight: 8 }} /> : null}
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* categories: round icon tiles */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          className="mt-6"
          contentContainerStyle={{ paddingHorizontal: 24 }}
          ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
          renderItem={({ item }) => {
            const on = category === item.id;
            return (
              <Pressable onPress={() => setCategory(item.id)} className="items-center" style={{ width: 68 }}>
                <View
                  className={`h-16 w-16 items-center justify-center rounded-full border-2 ${
                    on ? "border-brand bg-brand-tint" : "border-transparent bg-white"
                  }`}
                >
                  <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  className={`mt-1.5 text-xs font-semibold ${on ? "text-brand" : "text-gray-700"}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />

        {error && !products.length ? (
          <Notice emoji="📡" title="Couldn't load products" body={error} action="Try again" onAction={reload} />
        ) : filtering ? (
          <>
            <SectionHeader
              title={searching && !results.length ? "Searching..." : `${results.length} result${results.length === 1 ? "" : "s"}`}
            />
            {results.length ? (
              <Grid data={results} width={gridWidth} />
            ) : searching ? (
              <SkeletonGrid width={gridWidth} />
            ) : (
              <Notice emoji="🔎" title="Nothing matches yet" body="Try another word or pick a different category." />
            )}
          </>
        ) : loading && !products.length ? (
          <SkeletonGrid width={gridWidth} />
        ) : (
          <>
            {/* deals banner: built from real price drops */}
            {deals.length ? (
              <View className="mx-6 mt-6 overflow-hidden rounded-3xl bg-brand p-5">
                <View className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15" />
                <Text className="text-xs font-bold uppercase tracking-wide text-white/80">Today's deals</Text>
                <Text className="mt-1 text-2xl font-extrabold text-white">Save up to {bestDeal}%</Text>
                <Text className="mt-1 text-sm text-white/90">
                  {deals.length} price drop{deals.length === 1 ? "" : "s"} from sellers around you
                </Text>
                <Text style={{ position: "absolute", right: 18, bottom: 10, fontSize: 46 }}>🛍️</Text>
              </View>
            ) : null}

            {deals.length ? (
              <>
                <SectionHeader title="Price drops" action="See all" onAction={() => setCategory("all")} />
                <FlatList
                  horizontal
                  data={deals}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                  renderItem={({ item }) => <ProductCard product={item} width={176} />}
                />
              </>
            ) : null}

            <SectionHeader title="Sellers near you" />
            {locStatus !== "granted" ? (
              <LocationNotice status={locStatus} onEnable={enable} />
            ) : nearSellers.length ? (
              <>
                {placeLabel ? (
                  <View className="-mt-1 mb-3 flex-row items-center px-6">
                    <Ionicons name="location" size={13} color="#F97316" />
                    <Text className="ml-1 text-xs text-gray-500">{placeLabel}</Text>
                  </View>
                ) : null}
                {/* vendor cards, like restaurant cards in food apps */}
                <FlatList
                  horizontal
                  data={nearSellers}
                  keyExtractor={(s) => s.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setQuery(item.name)}
                      className="overflow-hidden rounded-3xl bg-white"
                      style={{ width: 224 }}
                    >
                      <View className="h-24 items-center justify-center bg-brand-tint">
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} resizeMode="cover" className="h-24 w-full" />
                        ) : (
                          <Text style={{ fontSize: 44 }}>🏪</Text>
                        )}
                        <View className="absolute left-3 top-3 flex-row items-center rounded-full bg-white px-2.5 py-1">
                          <Ionicons name="navigate-outline" size={11} color="#F97316" />
                          <Text className="ml-1 text-xs font-bold text-gray-800">{formatKm(item.km, item.approx)}</Text>
                        </View>
                      </View>
                      <View className="p-3">
                        <Text numberOfLines={1} className="text-base font-extrabold text-gray-900">
                          {item.name}
                        </Text>
                        <View className="mt-1 flex-row items-center">
                          {item.rating ? (
                            <>
                              <Ionicons name="star" size={12} color="#F59E0B" />
                              <Text className="ml-1 mr-2 text-xs font-semibold text-gray-700">{item.rating}</Text>
                            </>
                          ) : null}
                          <Text numberOfLines={1} className="flex-1 text-xs text-gray-500">
                            {item.lga || placeLabel}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  )}
                />
              </>
            ) : (
              <View className="mx-6 rounded-2xl bg-white p-4">
                <Text className="text-sm text-gray-500">
                  {placeLabel ? `No sellers within ${RADIUS_KM} km of ${placeLabel} yet.` : `No sellers within ${RADIUS_KM} km yet.`}
                </Text>
              </View>
            )}

            <SectionHeader title="Popular right now" />
            {products.length ? (
              <Grid data={products.slice(0, 6)} width={gridWidth} />
            ) : (
              <Notice emoji="🛒" title="No products yet" body="Check back soon, sellers are adding stock." />
            )}

            {/* shop by category: one row per category that has products */}
            {groups.map((g) => (
              <View key={g.id}>
                <SectionHeader
                  title={`${g.emoji} ${g.label}`}
                  action={`See all (${g.items.length})`}
                  onAction={() => setCategory(g.id)}
                />
                <FlatList
                  horizontal
                  data={g.items.slice(0, 10)}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                  renderItem={({ item }) => <ProductCard product={item} width={176} />}
                />
              </View>
            ))}

            {/* community: real posts, updating live */}
            <SectionHeader title="From the community" action="Open feed" onAction={() => router.push("/feed")} />
            <View className="px-6">
              {community.loading && !community.posts.length ? (
                <ActivityIndicator color="#F97316" style={{ marginVertical: 16 }} />
              ) : community.posts.length ? (
                community.posts.map((post) => (
                  <Pressable
                    key={post.feedId}
                    onPress={() => router.push("/feed")}
                    className="mb-3 flex-row items-center rounded-3xl bg-white p-3"
                  >
                    {post.images?.[0]?.url ? (
                      <Image source={{ uri: post.images[0].url }} className="h-16 w-16 rounded-2xl bg-gray-200" />
                    ) : (
                      <View
                        style={{ backgroundColor: post.tint || "#FFF3E6" }}
                        className="h-16 w-16 items-center justify-center rounded-2xl"
                      >
                        <Text style={{ fontSize: 30 }}>{post.emoji || POST_EMOJI[post.type]}</Text>
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center">
                        <Text numberOfLines={1} className="shrink text-sm font-bold text-gray-900">
                          {post.author?.name}
                        </Text>
                        {post.author?.verified ? (
                          <Ionicons name="checkmark-circle" size={13} color="#16A34A" style={{ marginLeft: 3 }} />
                        ) : null}
                        <View
                          className={`ml-1.5 h-2 w-2 rounded-full ${isOnline(post.author?._id) ? "bg-green-500" : "bg-gray-300"}`}
                        />
                        <Text className="ml-2 text-xs text-gray-400">{post.time}</Text>
                      </View>
                      <Text numberOfLines={2} className="mt-0.5 text-sm text-gray-500">
                        {post.text}
                      </Text>
                      {post.price ? (
                        <Text className="mt-1 text-sm font-extrabold text-gray-900">
                          {formatNaira(post.price)}
                          {post.unit ? <Text className="text-xs font-medium text-gray-500"> / {post.unit}</Text> : null}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </Pressable>
                ))
              ) : (
                <Notice
                  emoji="📭"
                  title="No posts yet"
                  body="Sellers share fresh stock and prices here."
                  action="Post something"
                  onAction={() => router.push("/posts/create")}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}