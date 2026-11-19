import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { RADIUS_KM, nearbyLgas, reverseGeocode } from "./geo";

/**
 * status: "idle" | "loading" | "granted" | "denied" | "disabled" | "error"
 *  - denied:   user refused (or can no longer be asked) -> must open Settings
 *  - disabled: permission OK but phone location services are switched off
 */
export function useUserLocation() {
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [place, setPlace] = useState(null); // { lga, state }
  const [nearby, setNearby] = useState([]); // [{ name, km }]
  const [status, setStatus] = useState("idle");

  const locate = useCallback(async ({ prompt = true } = {}) => {
    setStatus((s) => (s === "granted" ? s : "loading"));
    try {
      // 1. permission
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain && prompt) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setStatus("denied");
          return { reason: "denied" };
        }
      }

      // 2. phone location services (GPS) switched on?
      let enabled = await Location.hasServicesEnabledAsync();
      if (!enabled && Platform.OS === "android" && prompt) {
        try {
          await Location.enableNetworkProviderAsync(); // shows Android's "turn on location" dialog
          enabled = await Location.hasServicesEnabledAsync();
        } catch {
          /* user said no */
        }
      }
      if (!enabled) {
        setStatus("disabled");
        return { reason: "disabled" };
      }

      // 3. position
      let pos;
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        pos = await Location.getLastKnownPositionAsync();
      }
      if (!pos) throw new Error("No position");

      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      setStatus("granted");
      return { coords: c };
    } catch {
      setStatus("error");
      return { reason: "error" };
    }
  }, []);

  // Ask once when the screen first opens.
  useEffect(() => {
    locate({ prompt: true });
  }, [locate]);

  // Resolve the user's LGA/state and the LGAs around them via the Nigeria API.
  const key = coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : null;
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    (async () => {
      const [p, n] = await Promise.allSettled([reverseGeocode(coords), nearbyLgas(coords, RADIUS_KM)]);
      if (cancelled) return;
      if (p.status === "fulfilled") setPlace(p.value);
      if (n.status === "fulfilled") setNearby(n.value);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Button handler: try again, and if the OS won't let us ask, send them to Settings.
  const enable = useCallback(async () => {
    const res = await locate({ prompt: true });
    if (res.reason === "denied" || res.reason === "disabled") {
      Alert.alert(
        "Turn on location",
        "Allow location for Savebite in your phone settings to see sellers near you.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [locate]);

  return { coords, place, nearby, status, locate, enable };
}