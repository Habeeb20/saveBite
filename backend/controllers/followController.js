import Follow from '../models/Follow.js';
import User from '../models/User.js';
import { fail } from '../utils/asyncHandler.js';
import { notifyUsers } from '../services/notify.js';
import { emitToUser } from '../socket/hub.js';

export const toggleFollow = async (req, res) => {
  const me = req.user._id;
  const target = req.params.userId;
  if (String(me) === target) return fail(res, 400, "You can't follow yourself");
  if (!(await User.exists({ _id: target }))) return fail(res, 404, 'User not found');

  const existing = await Follow.findOneAndDelete({ follower: me, following: target });
  if (existing) {
    await Promise.all([
      User.updateOne({ _id: me }, { $pull: { 'buyer.following': target } }),
      User.updateOne({ _id: target, 'seller.followersCount': { $gt: 0 } }, { $inc: { 'seller.followersCount': -1 } }),
    ]);
    return res.json({ following: false });
  }

  try {
    await Follow.create({ follower: me, following: target });
  } catch (e) {
    if (e.code === 11000) return res.json({ following: true });
    throw e;
  }
  await Promise.all([
    User.updateOne({ _id: me }, { $addToSet: { 'buyer.following': target } }),
    User.updateOne({ _id: target }, { $inc: { 'seller.followersCount': 1 } }),
  ]);
  emitToUser(target, 'follow:new', { userId: String(me) });
  notifyUsers({ userIds: [target], actor: me, type: 'follow', verb: 'started following you' }).catch(console.error);
  res.json({ following: true });
};

export const myFollowing = async (req, res) => {
  const ids = await Follow.find({ follower: req.user._id }).distinct('following');
  res.json({ ids: ids.map(String) });
};
