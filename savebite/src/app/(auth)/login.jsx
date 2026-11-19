import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Loader from "../../components/Loader";
import Input from "../../components/Input";
import Button from "../../components/Button";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import {
  authenticateWithBiometrics,
  clearDeviceToken,
  getBiometricInfo,
  getDeviceToken,
  getDeviceUserId,
  saveDeviceToken,
  setEnablePromptDeclined,
  wasEnablePromptDeclined,
} from "../../lib/biometrics";

// Open the fingerprint / face prompt automatically when this screen appears
const AUTO_PROMPT = true;

// Alert.alert as a promise, so we can wait for the user's answer
const confirmAsync = (title, message, confirmText) =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Logging you in...");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // { label, icon } when this phone has biometrics AND the user turned them on
  const [bio, setBio] = useState(null);
  const autoTried = useRef(false);

  /* ---------- biometric login ---------- */
  const loginWithBiometrics = async (info = bio) => {
    if (loading) return;
    setError("");

    const ok = await authenticateWithBiometrics(`Log in with ${info?.label ?? "biometrics"}`);
    if (!ok) return; // cancelled or failed: stay on the screen, no error

    const deviceToken = await getDeviceToken();
    if (!deviceToken) {
      setBio(null);
      setError("Please log in with your password.");
      return;
    }

    setLoadingMessage("Logging you in...");
    setLoading(true);
    try {
      const data = await api("/auth/biometric/login", {
        method: "POST",
        body: { deviceToken },
      });
      await signIn(data);
      router.replace("/home");
    } catch (e) {
      console.log("Biometric login error:", e?.message);
      if (e.code === "BIOMETRIC_INVALID") {
        await clearDeviceToken();
        setBio(null);
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Decide whether to show the biometric button (and open the prompt once)
  useEffect(() => {
    let active = true;
    (async () => {
      const [info, token] = await Promise.all([getBiometricInfo(), getDeviceToken()]);
      if (!active || !info || !token) return;
      setBio(info);
      if (AUTO_PROMPT && !autoTried.current) {
        autoTried.current = true;
        loginWithBiometrics(info);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- offer to turn biometrics on after a password login ---------- */
  const offerBiometricSetup = async (user) => {
    try {
      const info = await getBiometricInfo();
      if (!info) return;

      const userId = user?._id ?? user?.id;

      // A token saved for a different account must not log this user in as them
      const existingToken = await getDeviceToken();
      if (existingToken) {
        if ((await getDeviceUserId()) === String(userId)) return; // already enabled
        await clearDeviceToken();
      }

      if (await wasEnablePromptDeclined()) return;

      const yes = await confirmAsync(
        `Log in with ${info.label}?`,
        `Next time, skip the password and use ${info.label}.`,
        "Enable"
      );
      if (!yes) {
        await setEnablePromptDeclined(true);
        return;
      }

      if (!(await authenticateWithBiometrics(`Confirm ${info.label}`))) return;

      const { deviceToken } = await api("/auth/biometric/enable", {
        method: "POST",
        auth: true,
        body: { deviceName: Platform.OS === "ios" ? "iPhone" : "Android phone" },
      });
      await saveDeviceToken(deviceToken, userId);
    } catch (e) {
      // Never block the login because biometric setup failed
      console.log("Biometric setup skipped:", e?.message);
    }
  };

  /* ---------- password login ---------- */
  const submit = async () => {
    if (loading) return;
    const errs = {};
    if (!identifier.trim()) errs.identifier = "Enter your email or phone number";
    if (!password) errs.password = "Enter your password";
    setFieldErrors(errs);
    setError("");
    if (Object.keys(errs).length) return;

    setLoadingMessage("Logging you in...");
    setLoading(true);

    let data;
    try {
      data = await api("/auth/login", {
        method: "POST",
        body: { identifier: identifier.trim(), password },
      });
      console.log("signIn:", !!data?.accessToken, !!data?.refreshToken, data?.user?.firstName);
      await signIn(data);
    } catch (e) {
      console.log("Login error:", e?.message);
      setError(e.message);
      setLoading(false);
      return;
    }
    setLoading(false);

    await offerBiometricSetup(data.user);
    router.replace("/home");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-4 h-10 justify-center">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
              hitSlop={12}
              className="h-10 w-10 items-start justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </Pressable>
          </View>

          <View className="mb-8 items-center">
            <Image
              source={require("../../../assets/images/savebite-icon.png")}
              className="h-20 w-20 rounded-3xl"
              resizeMode="contain"
            />
            <Text className="mt-4 text-3xl font-extrabold text-gray-900">Welcome back</Text>
            <Text className="mt-1 text-base text-gray-500">Log in to continue to SaveBite</Text>
          </View>

          {error ? (
            <View className="mb-4 flex-row items-start rounded-2xl border border-red-200 bg-red-50 p-3">
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text className="ml-2 flex-1 text-sm text-red-700">{error}</Text>
            </View>
          ) : null}

          {bio ? (
            <>
              <Pressable
                onPress={() => loginWithBiometrics()}
                disabled={loading}
                className="mb-6 flex-row items-center justify-center rounded-2xl border-2 border-brand bg-brand-tint py-4"
              >
                <Ionicons name={bio.icon} size={26} color="#F97316" />
                <Text className="ml-3 text-base font-bold text-brand">Log in with {bio.label}</Text>
              </Pressable>

              <View className="mb-6 flex-row items-center">
                <View className="h-px flex-1 bg-gray-200" />
                <Text className="mx-3 text-xs text-gray-500">or use your password</Text>
                <View className="h-px flex-1 bg-gray-200" />
              </View>
            </>
          ) : null}

          <Input
            label="Email or phone number"
            icon="person-outline"
            placeholder="you@example.com or 0803 123 4567"
            value={identifier}
            onChangeText={(v) => {
              setIdentifier(v);
              setFieldErrors((e) => ({ ...e, identifier: undefined }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            error={fieldErrors.identifier}
            returnKeyType="next"
          />

          <Input
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setFieldErrors((e) => ({ ...e, password: undefined }));
            }}
            secure
            autoCapitalize="none"
            error={fieldErrors.password}
            onSubmitEditing={submit}
            returnKeyType="done"
          />

          <Pressable
            onPress={() => Alert.alert("Coming soon", "Password reset will be added next.")}
            className="mb-6 self-end"
          >
            <Text className="text-sm font-semibold text-brand">Forgot password?</Text>
          </Pressable>

          <Button title="Log in" onPress={submit} disabled={loading} />

          <View className="mt-8 flex-row justify-center">
            <Text className="text-gray-500">New to SaveBite? </Text>
            <Pressable onPress={() => router.replace("/register")}>
              <Text className="font-semibold text-brand">Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Loader visible={loading} message={loadingMessage} />
    </SafeAreaView>
  );
}