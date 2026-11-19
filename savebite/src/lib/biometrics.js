import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "biometric_device_token";
const USER_KEY = "biometric_user_id";
const DECLINED_KEY = "biometric_prompt_declined";

/**
 * Returns null when the phone has no biometrics set up, otherwise
 * { kind, label, icon } describing what this phone uses.
 */
export async function getBiometricInfo() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return null;

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const T = LocalAuthentication.AuthenticationType;
    const ios = Platform.OS === "ios";

    if (types.includes(T.FACIAL_RECOGNITION)) {
      return { kind: "face", label: ios ? "Face ID" : "Face unlock", icon: "scan-outline" };
    }
    if (types.includes(T.FINGERPRINT)) {
      return { kind: "fingerprint", label: ios ? "Touch ID" : "Fingerprint", icon: "finger-print" };
    }
    return { kind: "biometric", label: "Biometrics", icon: "lock-closed-outline" };
  } catch {
    return null;
  }
}

/**
 * Shows the system Face ID / fingerprint prompt.
 * Resolves to true only when the user passes it.
 */
export async function authenticateWithBiometrics(promptMessage = "Log in to SaveBite") {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      fallbackLabel: "Use passcode",
    });
    return result.success;
  } catch {
    return false;
  }
}

/* ---------- device token (issued by /auth/biometric/enable) ---------- */

export async function getDeviceToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getDeviceUserId() {
  try {
    return await SecureStore.getItemAsync(USER_KEY);
  } catch {
    return null;
  }
}

export async function saveDeviceToken(token, userId) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (userId) await SecureStore.setItemAsync(USER_KEY, String(userId));
  await SecureStore.deleteItemAsync(DECLINED_KEY).catch(() => {});
}

export async function clearDeviceToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
}

export async function isBiometricLoginEnabled() {
  return !!(await getDeviceToken());
}

/* ---------- "don't ask me again" for the enable prompt ---------- */

export async function wasEnablePromptDeclined() {
  try {
    return (await SecureStore.getItemAsync(DECLINED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setEnablePromptDeclined(declined) {
  try {
    if (declined) await SecureStore.setItemAsync(DECLINED_KEY, "1");
    else await SecureStore.deleteItemAsync(DECLINED_KEY);
  } catch {
    /* ignore storage errors */
  }
}