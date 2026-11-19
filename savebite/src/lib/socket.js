import { io } from "socket.io-client";

// Socket.IO lives on the server root (not under /api).
const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? API.replace(/\/api\/?$/, "");

let socket = null;

export function connectSocket(token) {
  if (socket && socket.auth?.token === token) return socket;
  socket?.disconnect();
  socket = io(URL, { auth: { token }, transports: ["websocket"], reconnectionDelayMax: 5000 });
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
