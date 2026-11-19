// import { useEffect } from "react";
// import { Platform } from "react-native";
// import * as Notifications from "expo-notifications";
// import * as Device from "expo-device";
// import Constants from "expo-constants";
// import { useRouter } from "expo-router";
// import { api } from "./api";

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: false,
//     shouldSetBadge: false,
//   }),
// });

// /** Ask permission, get this phone's Expo push token and tell the server. Throws a readable Error. */
// export async function enablePush() {
//   if (!Device.isDevice) throw new Error("Push notifications only work on a real phone.");

//   let { status } = await Notifications.getPermissionsAsync();
//   if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
//   if (status !== "granted") throw new Error("Allow notifications for SaveBite in your phone settings.");

//   if (Platform.OS === "android") {
//     await Notifications.setNotificationChannelAsync("default", {
//       name: "Default",
//       importance: Notifications.AndroidImportance.MAX,
//     });
//   }
//   const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
//   const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
//   await api("/notifications/settings", { method: "PATCH", auth: true, body: { enabled: true, token } });
//   return token;
// }


// export const disablePush = () =>
//   api("/notifications/settings", { method: "PATCH", auth: true, body: { enabled: false } });

// /** Call before signing out so the next person on this phone doesn't get your notifications. */
// export async function forgetPushToken() {
//   try {
//     const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
//     const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
//     await api("/notifications/push-token/remove", { method: "POST", auth: true, body: { token } });
//   } catch {}
// }

// /** Open the right screen when someone taps a notification. */
// export function usePushTaps() {
//   const router = useRouter();
//   useEffect(() => {
//     const sub = Notifications.addNotificationResponseReceivedListener((r) => {
//       const d = r.notification.request.content.data ?? {};
//       if (d.type === "message" && d.actorId) router.push(`/chat/${d.actorId}`);
//       else router.push("/feed");
//     });
//     return () => sub.remove();
//   }, [router]);
// }




import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { api } from "./api";

// The chat the user is looking at right now: don't pop a banner for messages from that person.
let activeChatId = null;
export const setActiveChat = (id) => { activeChatId = id ? String(id) : null; };

// Runs only while the app is OPEN. When it is in the background or closed, the phone shows the
// notification by itself - no code needed.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const d = n.request.content.data ?? {};
    const hide = d.type === "message" && d.actorId && String(d.actorId) === activeChatId;
    return {
      shouldShowBanner: !hide,
      shouldShowList: !hide,
      shouldPlaySound: !hide,
      shouldSetBadge: false,
    };
  },
});

const getProjectId = () => {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!id) throw new Error("Push isn't set up yet. Run `npx eas init` to add your EAS projectId.");
  return id;
};

/** Ask permission, get this phone's Expo push token and tell the server. Throws a readable Error. */
export async function enablePush() {
  if (!Device.isDevice) throw new Error("Push notifications only work on a real phone.");

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") throw new Error("Allow notifications for SaveBite in your phone settings.");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
  await api("/notifications/settings", {
    method: "PATCH",
    auth: true,
    body: { enabled: true, token, platform: Platform.OS },
  });
  return token;
}

export const disablePush = () =>
  api("/notifications/settings", { method: "PATCH", auth: true, body: { enabled: false } });

/** Call before signing out so the next person on this phone doesn't get your notifications. */
export async function forgetPushToken() {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
    await api("/notifications/push-token/remove", { method: "POST", auth: true, body: { token } });
  } catch {}
}

/** Open the right screen when someone taps a notification - also when the app was fully closed. */
export function usePushTaps() {
  const router = useRouter();
  useEffect(() => {
    const open = (r) => {
      const d = r?.notification?.request?.content?.data ?? {};
      if (d.type === "message" && d.actorId) router.push(`/chat/${d.actorId}`);
      else router.push("/feed");
    };
    const last = Notifications.getLastNotificationResponse(); // the tap that launched the app
    if (last) open(last);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}