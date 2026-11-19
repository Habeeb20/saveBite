import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendMessage, markRead } from '../services/chat.js';
import { setIO, addConn, removeConn, isOnline, emitToUser } from './hub.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  setIO(io);

  // Authenticate with the same JWT the REST API uses: io(url, { auth: { token } })
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.userId = String(payload.id ?? payload._id ?? payload.userId ?? payload.sub);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    socket.join([`user:${uid}`, 'feed']);

    if (addConn(uid, socket.id)) {
      io.to(`presence:${uid}`).emit('presence:update', { userId: uid, online: true });
    }

    // client says "tell me when these people go on/offline" and gets their current state back
    socket.on('presence:watch', (ids, ack) => {
      const list = (Array.isArray(ids) ? ids : []).slice(0, 200).map(String);
      socket.join(list.map((i) => `presence:${i}`));
      const state = {};
      list.forEach((i) => { state[i] = isOnline(i); });
      ack?.(state);
    });

    socket.on('post:join', (id) => socket.join(`post:${id}`));
    socket.on('post:leave', (id) => socket.leave(`post:${id}`));

    socket.on('typing', ({ to, typing }) => emitToUser(to, 'typing', { from: uid, typing: !!typing }));

    socket.on('message:send', async (payload, ack) => {
      try {
        const message = await sendMessage({ from: uid, to: payload?.to, text: payload?.text, clientId: payload?.clientId });
        ack?.({ ok: true, message });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('message:read', async ({ conversationId } = {}, ack) => {
      try { await markRead(conversationId, uid); ack?.({ ok: true }); } catch { ack?.({ ok: false }); }
    });

    socket.on('disconnect', async () => {
      if (removeConn(uid, socket.id)) {
        const lastSeen = new Date();
        await User.updateOne({ _id: uid }, { $set: { lastSeen } }).catch(() => {});
        io.to(`presence:${uid}`).emit('presence:update', { userId: uid, online: false, lastSeen });
      }
    });
  });

  return io;
}
