import { useMemo, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useMe } from "../../lib/useMe";
import { useSellerSummary } from "../../lib/useSellerSummary";
import { formatNaira } from "../../lib/mockData";
import { SERVICES, serviceMeta } from "../../lib/billsConfig";

const ROLE_LABEL = { buyer: "Buyer", seller: "Seller", rider: "Rider", admin: "Admin" };
const SUBTITLE = {
  buyer: "Your spending and activity",
  seller: "How your shop is doing",
  rider: "Your deliveries and availability",
  admin: "Platform overview",
};

const comingSoon = (what) => Alert.alert("Coming soon", `${what} will be added next.`);

/* ----------------------------- building blocks ----------------------------- */

function Sample() {
  return (
    <View className="rounded-full bg-gray-100 px-2.5 py-1">
      <Text className="text-xs font-semibold text-gray-500">Sample data</Text>
    </View>
  );
}

function Section({ title, sample, children }) {
  return (
    <View className="mt-7">
      <View className="mb-3 flex-row items-center justify-between px-6">
        <Text className="text-xl font-extrabold text-gray-900">{title}</Text>
        {sample ? <Sample /> : null}
      </View>
      {children}
    </View>
  );
}

function StatGrid({ items }) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View className="px-6">
      {rows.map((row, i) => (
        <View key={i} className="mb-3 flex-row">
          {row.map((s, j) => (
            <View key={s.label} className={`flex-1 rounded-3xl bg-white p-4 ${j === 0 ? "mr-1.5" : "ml-1.5"}`}>
              <View style={{ backgroundColor: s.tint }} className="mb-3 h-10 w-10 items-center justify-center rounded-xl">
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text numberOfLines={1} className="text-xl font-extrabold text-gray-900">
                {s.value}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">{s.label}</Text>
            </View>
          ))}
          {row.length === 1 ? <View className="ml-1.5 flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

const stat = (icon, label, value, color = "#F97316", tint = "#FFEDD5") => ({ icon, label, value, color, tint });

function ActionRow({ actions }) {
  return (
    <View className="mx-6 flex-row rounded-3xl bg-white p-4">
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} className="flex-1 items-center active:opacity-70">
          <View style={{ backgroundColor: a.tint || "#FFEDD5" }} className="h-12 w-12 items-center justify-center rounded-2xl">
            <Ionicons name={a.icon} size={22} color={a.color || "#F97316"} />
          </View>
          <Text className="mt-2 text-center text-xs font-semibold text-gray-800">{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const VERIFY = {
  verified: { icon: "shield-checkmark", color: "#16A34A", bg: "bg-money-tint", title: "Verified", text: "Buyers can see your verified badge." },
  pending: { icon: "time", color: "#F59E0B", bg: "bg-amber-50", title: "Verification pending", text: "We're reviewing your details." },
  rejected: { icon: "close-circle", color: "#DC2626", bg: "bg-red-50", title: "Verification rejected", text: "Update your details and try again." },
  unverified: { icon: "shield-outline", color: "#6B7280", bg: "bg-gray-100", title: "Not verified yet", text: "Get a badge so people trust your listings." },
};

function VerificationCard({ status = "unverified", reason }) {
  const v = VERIFY[status] || VERIFY.unverified;
  return (
    <View className="mx-6 mt-5 flex-row items-center rounded-3xl bg-white p-4">
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${v.bg}`}>
        <Ionicons name={v.icon} size={24} color={v.color} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-bold text-gray-900">{v.title}</Text>
        <Text className="text-xs text-gray-500">{status === "rejected" && reason ? reason : v.text}</Text>
      </View>
      {status === "unverified" || status === "rejected" ? (
        <Pressable onPress={() => comingSoon("Verification")} className="rounded-full bg-brand px-4 py-2">
          <Text className="text-sm font-bold text-white">Verify</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Empty({ emoji, title, text }) {
  return (
    <View className="mx-6 items-center rounded-3xl bg-white px-6 py-10">
      <Text style={{ fontSize: 38 }}>{emoji}</Text>
      <Text className="mt-3 text-base font-semibold text-gray-900">{title}</Text>
      {text ? <Text className="mt-1 text-center text-sm text-gray-500">{text}</Text> : null}
    </View>
  );
}

/* ----------------------------- role views ----------------------------- */

function BuyerView({ me, router }) {
  const txs = me?.wallet?.transactions || [];

  // Real numbers from the recent wallet history (the server sends the latest 20)
  const { spent, byService } = useMemo(() => {
    const now = new Date();
    let total = 0;
    const map = {};
    txs.forEach((t) => {
      const d = new Date(t.timestamp);
      const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (t.type === "debit" && t.status === "success" && sameMonth) {
        total += t.amount || 0;
        const key = t.details?.service || "other";
        map[key] = (map[key] || 0) + (t.amount || 0);
      }
    });
    return { spent: total, byService: map };
  }, [txs]);

  const breakdown = Object.entries(byService).sort((a, b) => b[1] - a[1]);
  const top = breakdown[0]?.[1] || 1;

  return (
    <>
      <View className="mt-5">
        <StatGrid
          items={[
            stat("wallet-outline", "Wallet balance", formatNaira(me?.wallet?.balance ?? 0)),
            stat("trending-down-outline", "Spent this month", formatNaira(spent), "#DC2626", "#FEE2E2"),
            stat("storefront-outline", "Sellers followed", String(me?.buyer?.following?.length ?? 0), "#2563EB", "#DBEAFE"),
            stat("bookmark-outline", "Saved posts", String(me?.buyer?.savedPosts?.length ?? 0), "#7C3AED", "#EDE9FE"),
          ]}
        />
      </View>

      <Section title="Quick pay">
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
        <ActionRow
          actions={SERVICES.map((s) => ({
            label: s.label,
            icon: s.icon,
            color: s.color,
            tint: s.tint,
            onPress: () => router.push(`/bills/${s.id}`),
          }))}
        />
      </Section>

      <Section title="Where your money goes">
        {breakdown.length ? (
          <View className="mx-6 rounded-3xl bg-white p-5">
            {breakdown.map(([key, value]) => {
              const meta = serviceMeta(key);
              return (
                <View key={key} className="mb-4">
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="text-sm font-semibold text-gray-800">{meta?.label || "Other"}</Text>
                    <Text className="text-sm font-bold text-gray-900">{formatNaira(value)}</Text>
                  </View>
                  <View className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <View
                      style={{ width: `${Math.max(6, (value / top) * 100)}%`, backgroundColor: meta?.color || "#9CA3AF" }}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Empty emoji="📊" title="Nothing spent this month" text="Your bill payments and purchases will show up here." />
        )}
      </Section>
    </>
  );
}

function ProductThumb({ product }) {
  const uri = product.images?.[0]?.url;
  return uri ? (
    <Image source={{ uri }} className="h-11 w-11 rounded-xl bg-gray-200" />
  ) : (
    <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-tint">
      <Ionicons name="cube-outline" size={20} color="#F97316" />
    </View>
  );
}

function SellerView({ me, router, summary }) {
  const s = me?.seller || {};
  const rating = s.rating?.count ? `${s.rating.average.toFixed(1)} (${s.rating.count})` : "New";

  const stats = summary.data?.stats;
  const recent = summary.data?.recent || [];
  const lowStock = summary.data?.lowStock || [];
  const needsAttention = (stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0);

  return (
    <>
      <VerificationCard status={me?.verification?.status} reason={me?.verification?.reason} />

      <View className="mt-5">
        <StatGrid
          items={[
            stat("cube-outline", "Products", String(stats?.total ?? 0)),
            stat("alert-circle-outline", "Low / out of stock", String(needsAttention), "#DC2626", "#FEE2E2"),
            stat("people-outline", "Followers", String(s.followersCount ?? 0), "#2563EB", "#DBEAFE"),
            stat("star-outline", "Rating", rating, "#CA8A04", "#FEF9C3"),
            stat("wallet-outline", "Wallet balance", formatNaira(me?.wallet?.balance ?? 0), "#16A34A", "#DCFCE7"),
            stat("images-outline", "Posts", String(s.postsCount ?? 0), "#7C3AED", "#EDE9FE"),
          ]}
        />
      </View>


      

      <Section title="Shop tools">
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
      </Section>

      {summary.error && !summary.data ? (
        <Section title="Your products">
          <Empty emoji="📡" title="Couldn't load your products" text="Pull down to try again." />
        </Section>
      ) : null}

      {lowStock.length ? (
        <Section title="Running low">
          <View className="mx-6 rounded-3xl bg-white px-4 py-2">
            {lowStock.map((p, i) => (
              <View key={p._id} className={`flex-row items-center py-3 ${i ? "border-t border-gray-100" : ""}`}>
                <ProductThumb product={p} />
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">{p.name}</Text>
                  <Text className={`text-xs font-semibold ${p.stockQuantity <= 0 ? "text-red-600" : "text-amber-600"}`}>
                    {p.stockQuantity <= 0 ? "Out of stock" : `${p.stockQuantity} left (alert at ${p.lowStockAlert})`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {!(summary.error && !summary.data) ? (
        <Section title="Recent products">
          {recent.length ? (
            <View className="mx-6 rounded-3xl bg-white px-4 py-2">
              {recent.map((p, i) => (
                <View key={p._id} className={`flex-row items-center py-3 ${i ? "border-t border-gray-100" : ""}`}>
                  <ProductThumb product={p} />
                  <View className="ml-3 flex-1">
                    <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">{p.name}</Text>
                    <Text className="text-xs capitalize text-gray-500">{p.category}</Text>
                  </View>
                  <Text className="text-sm font-bold text-gray-900">{formatNaira(p.price)}</Text>
                </View>
              ))}
              <Pressable onPress={() => router.push("/products")} className="items-center border-t border-gray-100 py-3">
                <Text className="text-sm font-bold text-brand">See all products</Text>
              </Pressable>
            </View>
          ) : (
            <Empty
              emoji="🛒"
              title={summary.loading ? "Loading your products..." : "No products yet"}
              text={summary.loading ? undefined : "Tap New product above to add your first one."}
            />
          )}
        </Section>
      ) : null}
    </>
  );
}

function RiderView({ me }) {
  const r = me?.rider || {};
  const [online, setOnline] = useState(!!r.isAvailable);
  const rating = r.rating?.count ? `${r.rating.average.toFixed(1)} (${r.rating.count})` : "New";
  const vehicle = [r.vehicleType, r.plateNumber].filter(Boolean).join(" · ") || "Not set";

  return (
    <>
      {/* availability */}
      <View className="mx-6 mt-5 flex-row items-center rounded-3xl bg-white p-4">
        <View className={`h-12 w-12 items-center justify-center rounded-2xl ${online ? "bg-money-tint" : "bg-gray-100"}`}>
          <Ionicons name="bicycle" size={24} color={online ? "#16A34A" : "#6B7280"} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-gray-900">{online ? "You're online" : "You're offline"}</Text>
          <Text className="text-xs text-gray-500">
            {online ? "You can receive delivery requests." : "Go online to receive delivery requests."}
          </Text>
        </View>
        <Switch
          value={online}
          onValueChange={setOnline}
          trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
          thumbColor={online ? "#16A34A" : "#FFFFFF"}
        />
      </View>

      <VerificationCard status={me?.verification?.status} reason={me?.verification?.reason} />

      <View className="mt-5">
        <StatGrid
          items={[
            stat("checkmark-done-outline", "Deliveries", String(r.completedDeliveries ?? 0), "#16A34A", "#DCFCE7"),
            stat("star-outline", "Rating", rating, "#CA8A04", "#FEF9C3"),
            stat("wallet-outline", "Wallet balance", formatNaira(me?.wallet?.balance ?? 0)),
            stat("speedometer-outline", "Vehicle", vehicle, "#2563EB", "#DBEAFE"),
          ]}
        />
      </View>

      <Section title="Delivery requests">
        <Empty
          emoji="🛵"
          title="No requests yet"
          text={online ? "New delivery requests near you will appear here." : "Go online to start receiving requests."}
        />
      </Section>
    </>
  );
}

function AdminView() {
  const pending = [
    { id: "u1", name: "Mama Nkechi Foodstuff", role: "Seller", note: "Shop photo + stall number submitted" },
    { id: "u2", name: "Tunde Ola", role: "Rider", note: "Vehicle papers submitted" },
    { id: "u3", name: "Fresh Farms Lekki", role: "Seller", note: "Business registration submitted" },
  ];

  return (
    <>
      <View className="mt-5">
        <StatGrid
          items={[
            stat("people-outline", "Total users", "1,284", "#2563EB", "#DBEAFE"),
            stat("shield-half-outline", "Pending verification", String(pending.length), "#F59E0B", "#FEF3C7"),
            stat("ban-outline", "Blocked users", "12", "#DC2626", "#FEE2E2"),
            stat("cash-outline", "Wallet volume", formatNaira(8450000), "#16A34A", "#DCFCE7"),
          ]}
        />
      </View>

      <Section title="Waiting for verification" sample>
        <View className="mx-6 rounded-3xl bg-white px-4 py-2">
          {pending.map((u, i) => (
            <View key={u.id} className={`py-3 ${i ? "border-t border-gray-100" : ""}`}>
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">{u.name}</Text>
                  <Text className="text-xs text-gray-500">{u.role} · {u.note}</Text>
                </View>
              </View>
              <View className="mt-3 flex-row">
                <Pressable onPress={() => comingSoon("Verifying users")} className="mr-2 rounded-full bg-money px-4 py-2">
                  <Text className="text-xs font-bold text-white">Verify</Text>
                </Pressable>
                <Pressable onPress={() => comingSoon("Rejecting users")} className="mr-2 rounded-full border border-gray-300 px-4 py-2">
                  <Text className="text-xs font-bold text-gray-700">Reject</Text>
                </Pressable>
                <Pressable onPress={() => comingSoon("Blocking users")} className="rounded-full bg-red-50 px-4 py-2">
                  <Text className="text-xs font-bold text-red-600">Block</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </Section>
    </>
  );
}

/* ----------------------------- screen ----------------------------- */

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { me, refreshing, refresh } = useMe();

  const roles = user?.roles?.length ? user.roles : ["buyer"];
  const [view, setView] = useState(roles.includes(user?.activeRole) ? user.activeRole : roles[0]);

  // Real product stats for sellers. Reloads whenever this screen regains focus.
  const summary = useSellerSummary(roles.includes("seller"));
  const onRefresh = () => Promise.all([refresh(), summary.refresh()]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        <View className="px-6 pb-2 pt-2">
          <Text className="text-2xl font-extrabold text-gray-900">Dashboard</Text>
          <Text className="text-sm text-gray-500">{SUBTITLE[view]}</Text>
        </View>

        {/* switch between your roles */}
        {roles.length > 1 ? (
          <View className="mx-6 mt-3 flex-row rounded-2xl bg-gray-100 p-1">
            {roles.map((r) => (
              <Pressable
                key={r}
                onPress={() => setView(r)}
                className={`flex-1 items-center rounded-xl py-2.5 ${view === r ? "bg-white" : ""}`}
              >
                <Text className={`text-sm font-semibold ${view === r ? "text-brand" : "text-gray-500"}`}>
                  {ROLE_LABEL[r] || r}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {view === "buyer" && <BuyerView me={me} router={router} />}
        {view === "seller" && <SellerView me={me} router={router} summary={summary} />}
        {view === "rider" && <RiderView me={me} />}
        {view === "admin" && <AdminView />}
      </ScrollView>
    </SafeAreaView>
  );
}