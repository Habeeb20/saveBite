import { getSession, saveTokens, clearSession } from "./authStorage";

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001/api").replace(/\/$/, "");
console.log("API base URL:", BASE_URL);
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, status = 0, data = {}) {
    super(message);
    this.status = status;
    this.code = data?.code; // e.g. "SIGNUP_EXPIRED", "NETWORK"
    this.fieldErrors = data?.errors || null; // { phone: "..." } from the server
    this.data = data;
  }
  get isNetwork() {
    return this.code === "NETWORK";
  }
}

async function rawRequest(path, { method = "GET", body, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    console.error("API request failed:", e);
    throw new ApiError(
      e.name === "AbortError"
        ? "The request took too long. Please try again."
        : "Can't reach the server. Check your internet connection.",
      0,
      { code: "NETWORK" }
    );
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON response */
  }
console.log("API response:", res.status, data, res);
  if (!res.ok) {
    throw new ApiError(data.message || "Something went wrong. Please try again.", res.status, data);
  }
  return data;
}

// Only one refresh at a time, even if several requests fail together.
let refreshing = null;
function refreshTokens() {
  if (!refreshing) {
    refreshing = (async () => {
      const { refreshToken } = await getSession();
      if (!refreshToken) return false;
      try {
        const tokens = await rawRequest("/auth/refresh", { method: "POST", body: { refreshToken } });
        await saveTokens(tokens);
        return true;
      } catch (e) {
        // Only a real rejection logs the user out; being offline must not.
        if (e.status === 401 || e.status === 403) await clearSession();
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * api("/auth/login", { method: "POST", body: {...} })
 * api("/auth/me", { auth: true })   // sends the access token and refreshes it if expired
 */
export async function api(path, { method = "GET", body, auth = false } = {}) {
  const session = auth ? await getSession() : {};
  try {
    return await rawRequest(path, { method, body, token: session.accessToken });
  } catch (e) {
    if (auth && e.status === 401 && (await refreshTokens())) {
      const fresh = await getSession();
      return rawRequest(path, { method, body, token: fresh.accessToken });
    }
    throw e;
  }
}
