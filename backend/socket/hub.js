// Holds the Socket.IO instance + who is online, so controllers/services can emit
// without importing the socket handlers (avoids circular imports).
let io = null;
const online = new Map(); // userId -> Set(socketId)

export const setIO = (instance) => { io = instance; };
export const getIO = () => io;
export const isOnline = (id) => online.has(String(id));

// returns true when this is the user's FIRST connection (they just came online)
export function addConn(id, socketId) {
  const k = String(id);
  const set = online.get(k) ?? new Set();
  set.add(socketId);
  online.set(k, set);
  return set.size === 1;
}

// returns true when that was the user's LAST connection (they just went offline)
export function removeConn(id, socketId) {
  const k = String(id);
  const set = online.get(k);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) { online.delete(k); return true; }
  return false;
}

export const emitToUser = (id, event, payload) => io?.to(`user:${id}`).emit(event, payload);
export const emitFeed = (event, payload) => io?.to('feed').emit(event, payload);
export const emitPost = (postId, event, payload) => io?.to(`post:${postId}`).emit(event, payload);
