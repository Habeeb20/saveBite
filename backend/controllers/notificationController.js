import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { AUTHOR_FIELDS, authorView } from '../utils/serializers.js';
import { fail } from '../utils/asyncHandler.js';

export const list = async (req, res) => {
  const limit = 25;
  const filter = { user: req.user._id };
  if (req.query.cursor) filter.createdAt = { $lt: new Date(req.query.cursor) };
  const rows = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate('actor', AUTHOR_FIELDS).lean();
  res.json({
    notifications: rows.slice(0, limit).map((n) => ({
      _id: String(n._id), type: n.type, text: n.text, read: n.read, createdAt: n.createdAt,
      post: n.post ? String(n.post) : null, actor: authorView(n.actor),
    })),
    nextCursor: rows.length > limit ? rows[limit - 1].createdAt : null,
  });
};

export const unreadCount = async (req, res) =>
  res.json({ count: await Notification.countDocuments({ user: req.user._id, read: false }) });

export const readAll = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
};

export const readOne = async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.json({ ok: true });
};

const validToken = (t) => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t);

// turn phone notifications on/off (and register this phone's Expo push token)
export const settings = async (req, res) => {
  const { enabled, token, platform } = req.body;
  if (token !== undefined && !validToken(token)) return fail(res, 400, 'Invalid push token');

  if (token) {
    // pull then push, so a re-registered token never duplicates
    await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: { token } } });
    await User.updateOne(
      { _id: req.user._id },
      { $push: { pushTokens: { token, platform: ['ios', 'android'].includes(platform) ? platform : undefined } } }
    );
  }
  if (typeof enabled === 'boolean') {
    await User.updateOne({ _id: req.user._id }, { $set: { notificationsEnabled: enabled } });
  }
  const user = await User.findById(req.user._id).select('notificationsEnabled');
  res.json({ enabled: !!user?.notificationsEnabled });
};

export const removeToken = async (req, res) => {
  if (validToken(req.body.token)) {
    await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: { token: req.body.token } } });
  }
  res.json({ ok: true });
};
// call on logout so the next person on this phone doesn't get your notifications
