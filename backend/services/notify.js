
import Notification from '../models/Notification.js';
import Follow from '../models/Follow.js';
import User from '../models/User.js';
import { AUTHOR_FIELDS, authorView } from '../utils/serializers.js';
import { emitToUser } from '../socket/hub.js';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

async function sendPush(items) {
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(
          // priority high = delivered immediately on Android even when the phone is idle (Doze)
          chunk.map((m) => ({ sound: 'default', channelId: 'default', priority: 'high', ...m }))
        ),
      });
      const { data = [] } = await res.json();
      const dead = chunk.filter((_, idx) => data[idx]?.details?.error === 'DeviceNotRegistered').map((m) => m.to);
      if (dead.length) {
        await User.updateMany(
          { 'pushTokens.token': { $in: dead } },
          { $pull: { pushTokens: { token: { $in: dead } } } }
        );
      }
    } catch (e) {
      console.error('push failed:', e.message);
    }
  }
}

/**
 * 1) saves an in-app notification and shows it live over the socket, and
 * 2) sends a phone push to EVERY device of people who turned notifications on,
 *    whether the app is open, in the background or closed.
 */
export async function notifyUsers({ userIds, actor, type, post, verb, title, body, persist = true }) {
  const ids = [...new Set(userIds.map(String))].filter((id) => id !== String(actor));
  if (!ids.length) return;

  const a = await User.findById(actor).select(AUTHOR_FIELDS).lean();
  const actorView = authorView(a);
  const pushTitle = title ?? actorView?.name ?? 'SaveBite';
  const pushBody = body ?? `${actorView?.name ?? 'Someone'} ${verb}`;

  if (persist) {
    const docs = await Notification.insertMany(ids.map((user) => ({ user, actor, type, post, text: verb })));
    docs.forEach((d) =>
      emitToUser(d.user, 'notification:new', {
        _id: String(d._id), type, text: verb, post: post ? String(post) : null,
        read: false, createdAt: d.createdAt, actor: actorView,
      })
    );
  }

  const users = await User.find({
    _id: { $in: ids },
    notificationsEnabled: true,
    'pushTokens.0': { $exists: true },
  }).select('pushTokens').lean();

  await sendPush(
    users.flatMap((u) =>
      u.pushTokens.map((t) => ({
        to: t.token,
        title: pushTitle,
        body: pushBody,
        data: { type, postId: post ? String(post) : undefined, actorId: String(actor) },
      }))
    )
  );
}

// Tell everyone who follows `authorId` about their new post (works while they're offline too).
export async function notifyFollowersOfPost(post, authorId) {
  const followers = await Follow.find({ following: authorId }).distinct('follower');
  const verb = post.type === 'wanted' ? 'is looking for something' : post.type === 'menu' ? 'posted a new menu' : 'posted new stock';
  await notifyUsers({ userIds: followers, actor: authorId, type: 'post', post: post._id, verb });
}