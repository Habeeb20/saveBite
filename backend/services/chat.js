import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { emitToUser } from '../socket/hub.js';
import { notifyUsers } from './notify.js';

export const pairKey = (a, b) => [String(a), String(b)].sort().join('_');

export const getOrCreateConversation = (a, b) =>
  Conversation.findOneAndUpdate(
    { pair: pairKey(a, b) },
    { $setOnInsert: { pair: pairKey(a, b), participants: [a, b] } },
    { upsert: true, new: true }
  );

const payloadOf = (msg, conv, from, to, clientId) => ({
  _id: String(msg._id), conversationId: String(conv._id),
  sender: String(from), to: String(to), text: msg.text,
  createdAt: msg.createdAt, readAt: msg.readAt ?? null, clientId,
});

export async function sendMessage({ from, to, text, clientId }) {
  text = String(text ?? '').trim();
  if (!text || text.length > 2000) throw new Error('Message must be 1–2000 characters');
  if (String(from) === String(to)) throw new Error("You can't message yourself");
  if (!(await User.exists({ _id: to }))) throw new Error('User not found');

  const conv = await getOrCreateConversation(from, to);

  // a retry of a message we already saved (e.g. sent while the connection dropped)
  if (clientId) {
    const dup = await Message.findOne({ conversation: conv._id, sender: from, clientId });
    if (dup) return payloadOf(dup, conv, from, to, clientId);
  }

  const msg = await Message.create({ conversation: conv._id, sender: from, text, clientId });
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { lastMessage: { text, sender: from, createdAt: msg.createdAt } }, $inc: { [`unread.${to}`]: 1 } }
  );

  const payload = payloadOf(msg, conv, from, to, clientId);
  emitToUser(to, 'message:new', payload);
  emitToUser(from, 'message:new', payload); // other devices / echo (client de-dupes by clientId)

  notifyUsers({
    userIds: [to], actor: from, type: 'message', persist: false,
    verb: 'sent you a message', body: text.slice(0, 120),
  }).catch((e) => console.error(e));

  return payload;
}

export async function markRead(conversationId, userId) {
  const conv = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conv) return;
  const readAt = new Date();
  await Message.updateMany(
    { conversation: conv._id, sender: { $ne: userId }, readAt: null },
    { $set: { readAt } }
  );
  await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${userId}`]: 0 } });
  const other = conv.participants.find((p) => String(p) !== String(userId));
  emitToUser(other, 'message:read', { conversationId: String(conv._id), by: String(userId), readAt });
}
