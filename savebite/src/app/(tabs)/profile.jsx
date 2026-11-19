import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Loader from "../../components/Loader";
import { useAuth } from "../../context/AuthContext";
import { useMe } from "../../lib/useMe";
import { disablePush, enablePush, forgetPushToken } from "../../lib/usePushNotifications";

const ROLE_LABEL = { buyer: "Buyer", seller: "Seller", rider: "Rider", admin: "Admin" };

const comingSoon = (what) => Alert.alert("Coming soon", `${what} will be added next.`);

function Row({ icon, label, hint, onPress, danger, right }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-center px-4 py-4 active:bg-gray-50">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${danger ? "bg-red-50" : "bg-brand-tint"}`}>
        <Ionicons name={icon} size={20} color={danger ? "#DC2626" : "#F97316"} />
      </View>
      <View className="ml-3 flex-1">
        <Text className={`text-base font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>{label}</Text>
        {hint ? <Text className="text-xs text-gray-500">{hint}</Text> : null}
      </View>
      {right ?? (!danger ? <Ionicons name="chevron-forward" size={18} color="#9CA3AF" /> : null)}
    </Pressable>
  );
}

function Group({ children }) {
  return <View className="mx-6 mb-5 overflow-hidden rounded-3xl bg-white">{children}</View>;
}

const Divider = () => <View className="ml-16 h-px bg-gray-100" />;

export default function Profile() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const { me } = useMe();
  const user = { ...authUser, ...me }; // /me is the freshest copy of your profile

  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => { setNotif(!!me?.notificationsEnabled); }, [me?.notificationsEnabled]);

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "SB";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const avatar = user?.avatar?.url ?? (typeof user?.avatar === "string" ? user.avatar : null);
  const savedCount = user?.buyer?.savedPosts?.length ?? 0;
  const addressCount = user?.addresses?.length ?? 0;

  // turning notifications on asks the phone for permission and registers it for push
  const toggleNotifications = async (value) => {
    setNotifBusy(true);
    try {
      if (value) await enablePush();
      else await disablePush();
      setNotif(value);
    } catch (e) {
      setNotif(false);
      Alert.alert("Notifications", e.message || "Couldn't change notification settings.");
    } finally { setNotifBusy(false); }
  };

  const logout = () =>
    Alert.alert("Log out?", "You'll need to sign in again to use SaveBite.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await forgetPushToken(); // stop push for this phone before the token is gone
          await signOut(); // the tabs layout then redirects to the welcome screen
          setBusy(false);
        },
      },
    ]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pb-4 pt-2">
          <Text className="text-2xl font-extrabold text-gray-900">Me</Text>
        </View>

        {/* identity card */}
        <View className="mx-6 mb-6 items-center rounded-3xl bg-white p-6">
          {avatar ? (
            <Image source={{ uri: avatar }} className="h-20 w-20 rounded-full bg-gray-200" />
          ) : (
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand">
              <Text className="text-3xl font-extrabold text-white">{initials}</Text>
            </View>
          )}
          <Text className="mt-3 text-xl font-extrabold text-gray-900">{fullName || "SaveBite user"}</Text>
          {user?.email ? <Text className="mt-0.5 text-sm text-gray-500">{user.email}</Text> : null}
          {user?.phone ? <Text className="text-sm text-gray-500">{user.phone}</Text> : null}

          <View className="mt-3 flex-row flex-wrap justify-center">
            {(user?.roles || []).map((r) => (
              <View key={r} className={`m-1 rounded-full px-3 py-1 ${r === user?.activeRole ? "bg-brand" : "bg-brand-tint"}`}>
                <Text className={`text-xs font-bold ${r === user?.activeRole ? "text-white" : "text-brand"}`}>{ROLE_LABEL[r] || r}</Text>
              </View>
            ))}
          </View>

          {user?.seller ? (
            <View className="mt-4 flex-row">
              <View className="mx-4 items-center">
                <Text className="text-lg font-extrabold text-gray-900">{user.seller.followersCount ?? 0}</Text>
                <Text className="text-xs text-gray-500">Followers</Text>
              </View>
              <View className="mx-4 items-center">
                <Text className="text-lg font-extrabold text-gray-900">{user.seller.postsCount ?? 0}</Text>
                <Text className="text-xs text-gray-500">Posts</Text>
              </View>
              <View className="mx-4 items-center">
                <Text className="text-lg font-extrabold text-gray-900">{user?.buyer?.following?.length ?? 0}</Text>
                <Text className="text-xs text-gray-500">Following</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Group>
          <Row icon="person-outline" label="Edit profile" onPress={() => router.push("/account/edit")} />
          <Divider />
          <Row icon="location-outline" label="Addresses" hint={addressCount ? `${addressCount} saved` : "Where we deliver"} onPress={() => router.push("/account/addresses")} />
          <Divider />
          <Row icon="albums-outline" label="My posts" hint="Edit or delete what you've posted" onPress={() => router.push("/posts/manage")} />
          <Divider />
          <Row icon="bookmark-outline" label="Saved posts" hint={savedCount ? `${savedCount} saved` : undefined} onPress={() => router.push("/account/saved")} />
        </Group>

        <Group>
          <Row
            icon="notifications-outline"
            label="Notifications"
            hint="Get alerts for posts from people you follow, likes, comments and messages"
            right={
              notifBusy ? (
                <ActivityIndicator color="#F97316" />
              ) : (
                <Switch
                  value={notif}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: "#E5E7EB", true: "#FDBA74" }}
                  thumbColor={notif ? "#F97316" : "#FFFFFF"}
                />
              )
            }
          />
          <Divider />
          <Row icon="finger-print-outline" label="Fingerprint / Face ID" hint="Log in faster on this phone" onPress={() => comingSoon("Biometric login")} />
          <Divider />
          <Row icon="lock-closed-outline" label="Password & security" onPress={() => comingSoon("Security settings")} />
        </Group>

        <Group>
          <Row icon="help-circle-outline" label="Help & support" onPress={() => comingSoon("Support")} />
          <Divider />
          <Row icon="log-out-outline" label="Log out" danger onPress={logout} />
        </Group>

        <Text className="text-center text-xs text-gray-400">SaveBite · Eat well. Save more.</Text>
      </ScrollView>

      <Loader visible={busy} message="Logging out..." />
    </SafeAreaView>
  );
}
