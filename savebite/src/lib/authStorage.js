import * as SecureStore from "expo-secure-store";

// Tokens live in the phone's secure storage (Keychain on iOS, Keystore on Android).
const KEYS = { access: "sb.access", refresh: "sb.refresh", user: "sb.user" };

// SecureStore values should stay small, so only keep what the UI needs offline.
export const pickUser = (u) =>
  u
    ? {
        id: u._id || u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        roles: u.roles,
        dob: u.dob,
        activeRole: u.activeRole,
        avatar: u.avatar?.url,
      }
    : null;

export async function saveSession({ accessToken, refreshToken, user }) {
  await SecureStore.setItemAsync(KEYS.access, accessToken);
  await SecureStore.setItemAsync(KEYS.refresh, refreshToken);
  if (user) await SecureStore.setItemAsync(KEYS.user, JSON.stringify(pickUser(user)));
}

export async function saveTokens({ accessToken, refreshToken }) {
  await SecureStore.setItemAsync(KEYS.access, accessToken);
  await SecureStore.setItemAsync(KEYS.refresh, refreshToken);
}

export async function saveUser(user) {
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(pickUser(user)));
}

export async function getSession() {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.user),
  ]);
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }
  return { accessToken, refreshToken, user };
}

export async function clearSession() {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}
