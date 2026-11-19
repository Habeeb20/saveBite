import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { AUTHOR_FIELDS, authorView } from '../utils/serializers.js';
import { fail } from '../utils/asyncHandler.js';
import { getOrCreateConversation, markRead, sendMessage } from '../services/chat.js';

const unreadOf = (conv, me) => Number((conv.unread?.get ? conv.unread.get(String(me)) : conv.unread?.[String(me)]) ?? 0);

const convView = (c, me) => {
  const other = c.participants.find((p) => String(p._id) !== String(me));
  return {
    _id: String(c._id),
    other: authorView(other),
    lastMessage: c.lastMessage?.text
      ? { text: c.lastMessage.text, sender: String(c.lastMessage.sender), createdAt: c.lastMessage.createdAt }
      : null,
    unread: unreadOf(c, me),
    updatedAt: c.updatedAt,
  };
};

export const conversations = async (req, res) => {
  const rows = await Conversation.find({ participants: req.user._id, 'lastMessage.text': { $exists: true } })
    .sort({ updatedAt: -1 }).limit(100).populate('participants', AUTHOR_FIELDS).lean();
  res.json({ conversations: rows.map((c) => convView(c, req.user._id)) });
};

// open (or start) a chat with someone
export const openConversation = async (req, res) => {
  const { userId } = req.body;
  if (!userId || String(userId) === String(req.user._id)) return fail(res, 400, 'Choose someone to chat with');
  if (!(await User.exists({ _id: userId }))) return fail(res, 404, 'User not found');
  const conv = await getOrCreateConversation(req.user._id, userId);
  const full = await Conversation.findById(conv._id).populate('participants', AUTHOR_FIELDS).lean();
  res.json({ conversation: convView(full, req.user._id) });
};

export const messages = async (req, res) => {
  const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
  if (!conv) return fail(res, 404, 'Conversation not found');
  const limit = 30;
  const filter = { conversation: conv._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
  res.json({
    messages: rows.slice(0, limit).map((m) => ({
      _id: String(m._id), conversationId: String(m.conversation), sender: String(m.sender),
      text: m.text, createdAt: m.createdAt, readAt: m.readAt,
    })),
    hasMore: rows.length > limit,
  });
};

// REST fallback for when the socket is not connected
export const send = async (req, res) => {
  const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
  if (!conv) return fail(res, 404, 'Conversation not found');
  const to = conv.participants.find((p) => String(p) !== String(req.user._id));
  try {
    res.status(201).json({ message: await sendMessage({ from: req.user._id, to, text: req.body.text, clientId: req.body.clientId }) });
  } catch (e) { fail(res, 400, e.message); }
};

export const read = async (req, res) => {
  await markRead(req.params.id, req.user._id);
  res.json({ ok: true });
};

export const unreadCount = async (req, res) => {
  const rows = await Conversation.find({ participants: req.user._id }).select('unread').lean();
  res.json({ count: rows.reduce((n, c) => n + unreadOf(c, req.user._id), 0) });
};
