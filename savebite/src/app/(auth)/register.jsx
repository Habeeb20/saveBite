import { useEffect, useState } from "react";
import {
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
import OtpInput from "../../components/OtpInput";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* ----------------------------- options ----------------------------- */

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const ROLES = [
  { value: "buyer", icon: "bag-handle-outline", title: "Buyer", text: "Find food sellers, compare prices and save." },
  { value: "seller", icon: "storefront-outline", title: "Seller", text: "Post your stock or menu and chat with buyers." },
  { value: "rider", icon: "bicycle-outline", title: "Rider", text: "Deliver orders and earn." },
];

const SELLER_TYPES = [
  { value: "foodstuff", label: "Foodstuff & provisions" },
  { value: "cooked", label: "Cooked food / restaurant" },
];

const VEHICLES = [
  { value: "bicycle", label: "Bicycle" },
  { value: "motorbike", label: "Motorbike" },
  { value: "tricycle", label: "Tricycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
];

const MIN_AGE = 18;

// Which screen each server-side field error belongs to
const FIELD_STEP = {
  firstName: "details",
  lastName: "details",
  gender: "details",
  phone: "details",
  dob: "details",

  role: "role",
  businessName: "role",
  sellerType: "role",
  vehicleType: "role",
  address: "password",
  password: "password",
};
const STEP_ORDER = ["details", "role", "password"];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^(\+234|234|0)[789][01]\d{8}$/.test(v.replace(/[\s-]/g, ""));

/* ----------------------------- date of birth helpers ----------------------------- */

// Formats typed digits as DD/MM/YYYY while the user types
const formatDobInput = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

// Returns { iso: "YYYY-MM-DD" } when valid, or { error: "..." }
const parseDob = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return { error: "Enter your date of birth as DD/MM/YYYY" };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isRealDate || year < 1900) return { error: "Enter a valid date of birth" };

  const today = new Date();
  if (date > today) return { error: "Date of birth can't be in the future" };

  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < MIN_AGE) return { error: `You must be at least ${MIN_AGE} years old to sign up` };

  const pad = (n) => String(n).padStart(2, "0");
  return { iso: `${year}-${pad(month)}-${pad(day)}` };
};

/* ----------------------------- small pieces ----------------------------- */

function Chip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
        selected ? "border-brand bg-brand-tint" : "border-gray-200 bg-white"
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? "text-brand" : "text-gray-700"}`}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children, error }) {
  return (
    <View className="mb-2">
      <Text className="text-sm font-medium text-gray-700">{children}</Text>
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

function ProgressBar({ step }) {
  const index = STEP_ORDER.indexOf(step);
  return (
    <View className="mb-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step {index + 1} of {STEP_ORDER.length}
      </Text>
      <View className="flex-row">
        {STEP_ORDER.map((s, i) => (
          <View
            key={s}
            className={`mr-2 h-1.5 flex-1 rounded-full ${i <= index ? "bg-brand" : "bg-gray-200"}`}
          />
        ))}
      </View>
    </View>
  );
}

/* ----------------------------- screen ----------------------------- */

export default function Register() {
  const router = useRouter();
  const { signIn } = useAuth();

  // email -> code -> details -> role -> password
  const [step, setStep] = useState("email");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "", phone: "", dob: "" });
  const [role, setRole] = useState("buyer");
  const [businessName, setBusinessName] = useState("");
  const [sellerType, setSellerType] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [address, setAddress] = useState("");

  const setField = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  // resend countdown
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /* ---------- error handling ---------- */
  const handleError = (e) => {
    if (e.code === "SIGNUP_EXPIRED") {
      setSignupToken(null);
      setCode("");
      setStep("email");
      setError("Your verification expired. Please verify your email again.");
      return;
    }
    if (e.fieldErrors) {
      setFieldErrors(e.fieldErrors);
      const steps = Object.keys(e.fieldErrors)
        .map((k) => FIELD_STEP[k])
        .filter(Boolean);
      const first = STEP_ORDER.find((s) => steps.includes(s));
      if (first) setStep(first);
    }
    if (e.code === "RESEND_COOLDOWN" && e.data?.retryAfter) setResendIn(e.data.retryAfter);
    setError(e.message || "Something went wrong. Please try again.");
  };

  /* ---------- request helper: shows the loader and handles errors ---------- */
  const run = async (message, fn) => {
    setLoading(true);
    setLoadingMessage(message);
    setError("");
    try {
      return await fn();
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /* ---------- step 1: email ---------- */
  const sendCode = async (isResend = false) => {
    if (loading) return;
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) {
      setFieldErrors({ email: "Enter a valid email address" });
      return;
    }
    setFieldErrors({});
    const res = await run(isResend ? "Sending a new code..." : "Sending your code...", () =>
      api(isResend ? "/auth/signup/resend" : "/auth/signup/start", {
        method: "POST",
        body: { email: value },
      })
    );
    if (res) {
      setEmail(value);
      setCode("");
      setResendIn(res.resendAfter ?? 60);
      setStep("code");
    }
  };

  /* ---------- step 2: 4-digit code ---------- */
  const verifyCode = async (value = code) => {
    if (loading) return;
    if (value.length !== 4) {
      setFieldErrors({ code: "Enter the 4-digit code" });
      return;
    }
    setFieldErrors({});
    const res = await run("Verifying your code...", () =>
      api("/auth/signup/verify", { method: "POST", body: { email, code: value } })
    );
    if (res) {
      setSignupToken(res.signupToken);
      setStep("details");
    } else {
      setCode("");
    }
  };

  const onCodeChange = (value) => {
    setCode(value);
    setFieldErrors({});
    setError("");
    if (value.length === 4) verifyCode(value); // submit automatically
  };

  /* ---------- step 3a: personal details ---------- */
  const nextFromDetails = () => {
    const errs = {};
    if (form.firstName.trim().length < 2) errs.firstName = "Enter your first name";
    if (form.lastName.trim().length < 2) errs.lastName = "Enter your last name";
    if (!form.gender) errs.gender = "Select your gender";
    if (!isPhone(form.phone)) errs.phone = "Enter a valid Nigerian phone number";
    const dob = parseDob(form.dob);
    if (dob.error) errs.dob = dob.error;
    setFieldErrors(errs);
    setError("");
    if (!Object.keys(errs).length) setStep("role");
  };

  /* ---------- step 3b: role ---------- */
  const nextFromRole = () => {
    const errs = {};
    if (role === "seller") {
      if (businessName.trim().length < 2) errs.businessName = "Enter your business name";
      if (!sellerType) errs.sellerType = "Choose what you sell";
    }
    if (role === "rider" && !vehicleType) errs.vehicleType = "Choose your vehicle type";
    setFieldErrors(errs);
    setError("");
    if (!Object.keys(errs).length) setStep("password");
  };

  /* ---------- step 3c: password, then create the account ---------- */
  const submit = async () => {
    if (loading) return;

    const errs = {};
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errs.password = "Use at least 8 characters with a letter and a number";
    }
 
if (confirm !== password) errs.confirm = "Passwords don't match";
if (address.trim().length < 5) errs.address = "Enter your full address";   // add
    // Re-check the date here too, so the request never goes out with a bad value
    const dob = parseDob(form.dob);
    if (dob.error) {
      errs.dob = dob.error;
      setFieldErrors(errs);
      setStep("details");
      return;
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    const body = {
      signupToken,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      phone: form.phone.trim(),
      dob: dob.iso, // YYYY-MM-DD
      address: address.trim(), // add
      password,
      role,
      ...(role === "seller" && { businessName: businessName.trim(), sellerType }),
      ...(role === "rider" && { vehicleType }),
    };

    const res = await run("Creating your account...", () =>
      api("/auth/signup/complete", { method: "POST", body })
    );
    if (res) {
      await signIn(res);
      router.replace("/home");
    }
  };

  const goBack = () => {
    setError("");
    setFieldErrors({});
    if (step === "code") setStep("email");
    else if (step === "role") setStep("details");
    else if (step === "password") setStep("role");
    else router.back();
  };

  const showBack = step !== "details"; // the email is already verified at "details"
  const postVerify = STEP_ORDER.includes(step);

  const titles = {
    email: ["Create your account", "Enter your email and we'll send you a 4-digit code."],
    code: ["Check your email", `We sent a 4-digit code to ${email}`],
    details: ["Tell us about you", "This is how buyers and sellers will see you."],
    role: ["How will you use SaveBite?", "You can add more later."],
    password: ["Almost done", "Add your address and choose a password you'll remember."],
  
  };

  /* ----------------------------- render ----------------------------- */
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* top bar */}
          <View className="mb-4 h-10 justify-center">
            {showBack ? (
              <Pressable onPress={goBack} hitSlop={12} className="h-10 w-10 items-start justify-center">
                <Ionicons name="arrow-back" size={24} color="#1F2937" />
              </Pressable>
            ) : null}
          </View>

          {postVerify ? <ProgressBar step={step} /> : null}

          <Text className="text-3xl font-extrabold text-gray-900">{titles[step][0]}</Text>
          <Text className="mb-6 mt-2 text-base text-gray-500">{titles[step][1]}</Text>

          {error ? (
            <View className="mb-4 flex-row items-start rounded-2xl border border-red-200 bg-red-50 p-3">
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text className="ml-2 flex-1 text-sm text-red-700">{error}</Text>
            </View>
          ) : null}

          {/* ---------------- EMAIL ---------------- */}
          {step === "email" && (
            <>
              <Input
                label="Email address"
                icon="mail-outline"
                placeholder="you@example.com"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setFieldErrors({});
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                error={fieldErrors.email}
                onSubmitEditing={() => sendCode(false)}
                returnKeyType="send"
              />
              <Button title="Send code" onPress={() => sendCode(false)} disabled={loading} />
              <View className="mt-6 flex-row justify-center">
                <Text className="text-gray-500">Already have an account? </Text>
                <Pressable onPress={() => router.replace("/login")}>
                  <Text className="font-semibold text-brand">Log in</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ---------------- CODE ---------------- */}
          {step === "code" && (
            <>
              <OtpInput value={code} onChange={onCodeChange} error={fieldErrors.code} />
              <Button
                title="Verify"
                onPress={() => verifyCode()}
                disabled={loading || code.length !== 4}
                className="mt-8"
              />
              <View className="mt-6 items-center">
                {resendIn > 0 ? (
                  <Text className="text-gray-500">Resend code in {resendIn}s</Text>
                ) : (
                  <Pressable onPress={() => sendCode(true)} disabled={loading}>
                    <Text className="font-semibold text-brand">Resend code</Text>
                  </Pressable>
                )}
                <Pressable onPress={goBack} className="mt-4">
                  <Text className="text-gray-500">Wrong email? Change it</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ---------------- DETAILS ---------------- */}
          {step === "details" && (
            <>
              <View className="flex-row">
                <View className="mr-2 flex-1">
                  <Input
                    label="First name"
                    icon="person-outline"
                    placeholder="Ada"
                    value={form.firstName}
                    onChangeText={setField("firstName")}
                    autoCapitalize="words"
                    error={fieldErrors.firstName}
                  />
                </View>
                <View className="ml-2 flex-1">
                  <Input
                    label="Last name"
                    placeholder="Obi"
                    value={form.lastName}
                    onChangeText={setField("lastName")}
                    autoCapitalize="words"
                    error={fieldErrors.lastName}
                  />
                </View>
              </View>

              <Input
                label="Phone number"
                icon="call-outline"
                placeholder="0803 123 4567"
                value={form.phone}
                onChangeText={setField("phone")}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={fieldErrors.phone}
              />

              <Input
                label="Date of birth"
                icon="calendar-outline"
                placeholder="DD/MM/YYYY"
                value={form.dob}
                onChangeText={(v) => setField("dob")(formatDobInput(v))}
                keyboardType="number-pad"
                error={fieldErrors.dob}
              />

              <FieldLabel error={fieldErrors.gender}>Gender</FieldLabel>
              <View className="mb-6 flex-row flex-wrap">
                {GENDERS.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    selected={form.gender === g.value}
                    onPress={() => setField("gender")(g.value)}
                  />
                ))}
              </View>

              <Button title="Continue" onPress={nextFromDetails} />
            </>
          )}

          {/* ---------------- ROLE ---------------- */}
          {step === "role" && (
            <>
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => {
                      setRole(r.value);
                      setFieldErrors({});
                    }}
                    className={`mb-3 flex-row items-center rounded-2xl border-2 p-4 ${
                      selected ? "border-brand bg-brand-tint" : "border-gray-200 bg-white"
                    }`}
                  >
                    <View
                      className={`h-12 w-12 items-center justify-center rounded-xl ${
                        selected ? "bg-brand" : "bg-gray-100"
                      }`}
                    >
                      <Ionicons name={r.icon} size={24} color={selected ? "#FFFFFF" : "#6B7280"} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-bold text-gray-900">{r.title}</Text>
                      <Text className="mt-0.5 text-sm text-gray-500">{r.text}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color="#F97316" /> : null}
                  </Pressable>
                );
              })}

              {role === "seller" && (
                <View className="mt-3">
                  <Input
                    label="Business name"
                    icon="storefront-outline"
                    placeholder="Ada Foods"
                    value={businessName}
                    onChangeText={(v) => {
                      setBusinessName(v);
                      setFieldErrors((e) => ({ ...e, businessName: undefined }));
                    }}
                    autoCapitalize="words"
                    error={fieldErrors.businessName}
                  />
                  <FieldLabel error={fieldErrors.sellerType}>What do you sell?</FieldLabel>
                  <View className="flex-row flex-wrap">
                    {SELLER_TYPES.map((t) => (
                      <Chip
                        key={t.value}
                        label={t.label}
                        selected={sellerType === t.value}
                        onPress={() => {
                          setSellerType(t.value);
                          setFieldErrors((e) => ({ ...e, sellerType: undefined }));
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {role === "rider" && (
                <View className="mt-3">
                  <FieldLabel error={fieldErrors.vehicleType}>Your vehicle</FieldLabel>
                  <View className="flex-row flex-wrap">
                    {VEHICLES.map((v) => (
                      <Chip
                        key={v.value}
                        label={v.label}
                        selected={vehicleType === v.value}
                        onPress={() => {
                          setVehicleType(v.value);
                          setFieldErrors((e) => ({ ...e, vehicleType: undefined }));
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}

              <Button title="Continue" onPress={nextFromRole} className="mt-6" />
            </>
          )}

          {/* ---------------- PASSWORD ---------------- */}
          {step === "password" && (
            <>
            <Input
      label="Address"
      icon="location-outline"
      placeholder="12 Allen Avenue, Ikeja, Lagos"
      value={address}
      onChangeText={(v) => {
        setAddress(v);
        setFieldErrors((e) => ({ ...e, address: undefined }));
      }}
      autoCapitalize="words"
      autoComplete="street-address"
      error={fieldErrors.address}
    />

              <Input
                label="Password"
                icon="lock-closed-outline"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setFieldErrors((e) => ({ ...e, password: undefined }));
                }}
                secure
                autoCapitalize="none"
                error={fieldErrors.password}
              />
              <Input
                label="Confirm password"
                icon="lock-closed-outline"
                placeholder="Type it again"
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  setFieldErrors((e) => ({ ...e, confirm: undefined }));
                }}
                secure
                autoCapitalize="none"
                error={fieldErrors.confirm}
                onSubmitEditing={submit}
                returnKeyType="done"
              />
              <Text className="mb-6 text-xs text-gray-500">
                Use a letter and a number. Longer is safer.
              </Text>
              <Button title="Create account" onPress={submit} disabled={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Loader visible={loading} message={loadingMessage} />
    </SafeAreaView>
  );
}