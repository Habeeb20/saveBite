// Helpers for the free Nigeria location API (replaces Google Geocoding / Places).
// Docs: https://nigeria.jamiuadewaleyusuf.com  (no API key needed)
const GEO = "https://nigeria.jamiuadewaleyusuf.com/api/v1";

export const RADIUS_KM = 30;

const nameOf = (v) => (typeof v === "string" ? v : v?.name ?? null);

// "Ikeja LGA" / "Ikeja Local Government" / "ikeja" -> "ikeja"
export const normPlace = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\b(lga|local government( area)?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function geoGet(path) {
  const res = await fetch(`${GEO}${path}`, { headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === "error") throw new Error(json.message || "Location lookup failed");
  return json.data ?? {};
}

// lat/lng -> { lga, state }
export async function reverseGeocode({ lat, lng }) {
  const d = await geoGet(`/geocode/reverse?lat=${lat}&lng=${lng}`);
  return {
    lga: nameOf(d.lga) ?? d.lga_name ?? null,
    state: nameOf(d.state) ?? d.state_name ?? null,
  };
}

// LGAs within `radius` km -> [{ name, km }]
export async function nearbyLgas({ lat, lng }, radius = RADIUS_KM) {
  const d = await geoGet(`/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  const arr = Array.isArray(d) ? d : d.lgas ?? d.results ?? d.items ?? d.data ?? [];
  return arr
    .map((x) => ({
      name: x.name ?? x.lga ?? x.lga_name,
      km: Number(x.distance_km ?? x.distance ?? 0),
    }))
    .filter((x) => x.name);
}

export const formatKm = (km, approx) => {
  const t = km < 1 ? "<1 km" : `${km.toFixed(km < 10 ? 1 : 0)} km`;
  return approx && km >= 1 ? `~${t}` : t;
};