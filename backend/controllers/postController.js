import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Follow from '../models/Follow.js';
import User from '../models/User.js';
import { AUTHOR_FIELDS, authorView, countsOf } from '../utils/serializers.js';
import { fail } from '../utils/asyncHandler.js';
import { notifyUsers, notifyFollowersOfPost } from '../services/notify.js';
import { emitFeed, emitPost } from '../socket/hub.js';

const TYPES = ['stock', 'menu', 'wanted'];
const PAGE = 15;
const populateAuthor = [
  { path: 'author', select: AUTHOR_FIELDS },
  { path: 'repostOf', populate: { path: 'author', select: AUTHOR_FIELDS } },
];

const cleanImages = (images) =>
  (Array.isArray(images) ? images : [])
    .filter((i) => typeof i?.url === 'string' && i.url.startsWith('https://'))
    .slice(0, 6)
    .map((i) => ({ url: i.url, publicId: i.publicId }));

// turn raw posts into what the app renders (a repost shows the ORIGINAL post + who reposted it)
async function shape(posts, meId) {
  const me = await User.findById(meId).select('buyer.savedPosts').lean();
  const saved = new Set((me?.buyer?.savedPosts ?? []).map(String));
  const originals = posts.map((p) => p.repostOf ?? p);
  const mine = new Set(
    (await Post.find({ author: meId, repostOf: { $in: originals.map((o) => o._id) } }).distinct('repostOf')).map(String)
  );

  return posts.map((p) => {
    const o = p.repostOf ?? p;
    return {
      _id: String(o._id),
      feedId: String(p._id),
      type: o.type, text: o.text, images: o.images ?? [], emoji: o.emoji, tint: o.tint,
      price: o.price ?? null, unit: o.unit ?? null, createdAt: o.createdAt,
      likes: o.likesCount, comments: o.commentsCount, reposts: o.repostsCount, shares: o.sharesCount,
      liked: (o.likes ?? []).some((id) => String(id) === String(meId)),
      saved: saved.has(String(o._id)),
      reposted: mine.has(String(o._id)),
      author: authorView(o.author),
      repostedBy: p.repostOf ? authorView(p.author) : null,
    };
  });
}

async function page(req, filter) {
  const limit = Math.min(Number(req.query.limit) || PAGE, 30);
  if (req.query.cursor) filter.createdAt = { $lt: new Date(req.query.cursor) };
  const rows = await Post.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate(populateAuthor).lean();
  const slice = rows.slice(0, limit).filter((p) => !p.repostOf || p.repostOf._id); // skip orphans
  return {
    posts: await shape(slice, req.user._id),
    nextCursor: rows.length > limit ? rows[limit - 1].createdAt : null,
  };
}

/* ------------------------------ read ------------------------------ */

export const list = async (req, res) => {
  const { type, author, following } = req.query;
  const filter = {};
  if (TYPES.includes(type)) filter.type = type;
  if (author) filter.author = author;
  if (following === '1') filter.author = { $in: await Follow.find({ follower: req.user._id }).distinct('following') };
  res.json(await page(req, filter));
};

export const mine = async (req, res) => res.json(await page(req, { author: req.user._id, repostOf: null }));

export const saved = async (req, res) => {
  const me = await User.findById(req.user._id).select('buyer.savedPosts').lean();
  const ids = [...(me?.buyer?.savedPosts ?? [])].reverse().slice(0, 100);
  const rows = await Post.find({ _id: { $in: ids } }).populate(populateAuthor).lean();
  rows.sort((a, b) => ids.findIndex((i) => String(i) === String(a._id)) - ids.findIndex((i) => String(i) === String(b._id)));
  res.json({ posts: await shape(rows, req.user._id), nextCursor: null });
};

export const getOne = async (req, res) => {
  const p = await Post.findById(req.params.id).populate(populateAuthor).lean();
  if (!p) return fail(res, 404, 'Post not found');
  res.json({ post: (await shape([p], req.user._id))[0] });
};

/* ----------------------------- write ----------------------------- */

export const create = async (req, res) => {
  const { type, price, unit, emoji, tint, product } = req.body;
  const text = String(req.body.text ?? '').trim();
  if (!TYPES.includes(type)) return fail(res, 400, 'Choose a post type');
  if (text.length < 3 || text.length > 1000) return fail(res, 400, 'Write between 3 and 1000 characters');
  if (type !== 'wanted' && !req.user.roles?.includes('seller')) {
    return fail(res, 403, 'Only sellers can post stock or a menu');
  }
  const p = price === undefined || price === '' || price === null ? undefined : Number(price);
  if (p !== undefined && (Number.isNaN(p) || p < 0)) return fail(res, 400, 'Enter a valid price');

  const post = await Post.create({
    author: req.user._id, type, text, images: cleanImages(req.body.images),
    price: p, unit: unit?.trim() || undefined, emoji, tint, product: product || undefined,
  });
  await User.updateOne({ _id: req.user._id }, { $inc: { 'seller.postsCount': 1 } });

  const full = await Post.findById(post._id).populate(populateAuthor).lean();
  const [shaped] = await shape([full], req.user._id);

  emitFeed('post:new', { _id: shaped._id, type, authorId: String(req.user._id) });
  notifyFollowersOfPost(post, req.user._id).catch((e) => console.error(e)); // in-app + phone push
  res.status(201).json({ post: shaped });
};

export const update = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.repostOf) return fail(res, 404, 'Post not found');
  if (String(post.author) !== String(req.user._id)) return fail(res, 403, 'This is not your post');

  if (req.body.text !== undefined) {
    const t = String(req.body.text).trim();
    if (t.length < 3 || t.length > 1000) return fail(res, 400, 'Write between 3 and 1000 characters');
    post.text = t;
  }
  if (req.body.price !== undefined) {
    const p = req.body.price === '' || req.body.price === null ? undefined : Number(req.body.price);
    if (p !== undefined && (Number.isNaN(p) || p < 0)) return fail(res, 400, 'Enter a valid price');
    post.price = p;
  }
  if (req.body.unit !== undefined) post.unit = String(req.body.unit).trim() || undefined;
  if (req.body.images !== undefined) post.images = cleanImages(req.body.images);
  await post.save();
  emitFeed('post:updated', { postId: String(post._id) });

  const full = await Post.findById(post._id).populate(populateAuthor).lean();
  res.json({ post: (await shape([full], req.user._id))[0] });
};

export const remove = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.repostOf) return fail(res, 404, 'Post not found');
  if (String(post.author) !== String(req.user._id)) return fail(res, 403, 'This is not your post');

  await Promise.all([
    Post.deleteMany({ repostOf: post._id }),
    Comment.deleteMany({ post: post._id }),
    User.updateMany({ 'buyer.savedPosts': post._id }, { $pull: { 'buyer.savedPosts': post._id } }),
    User.updateOne({ _id: req.user._id, 'seller.postsCount': { $gt: 0 } }, { $inc: { 'seller.postsCount': -1 } }),
  ]);
  await post.deleteOne();
  emitFeed('post:deleted', { postId: String(post._id) });
  res.json({ ok: true });
};

/* --------------------------- interactions --------------------------- */

export const toggleLike = async (req, res) => {
  const me = req.user._id;
  const id = req.params.id;
  const had = await Post.exists({ _id: id, likes: me });
  const updated = await Post.findOneAndUpdate(
    had ? { _id: id, likes: me } : { _id: id, likes: { $ne: me } },
    had ? { $pull: { likes: me }, $inc: { likesCount: -1 } } : { $addToSet: { likes: me }, $inc: { likesCount: 1 } },
    { new: true }
  ).select('author likesCount commentsCount repostsCount sharesCount');
  if (!updated) return fail(res, 404, 'Post not found');

  emitFeed('post:counts', countsOf(updated));
  if (!had) {
    notifyUsers({ userIds: [updated.author], actor: me, type: 'like', post: id, verb: 'liked your post' }).catch(console.error);
  }
  res.json({ liked: !had, likesCount: updated.likesCount });
};

export const toggleSave = async (req, res) => {
  const me = req.user._id;
  const id = req.params.id;
  if (!(await Post.exists({ _id: id }))) return fail(res, 404, 'Post not found');
  const has = await User.exists({ _id: me, 'buyer.savedPosts': id });
  await User.updateOne({ _id: me }, has ? { $pull: { 'buyer.savedPosts': id } } : { $addToSet: { 'buyer.savedPosts': id } });
  res.json({ saved: !has });
};

export const toggleRepost = async (req, res) => {
  const me = req.user._id;
  const orig = await Post.findById(req.params.id);
  if (!orig || orig.repostOf) return fail(res, 404, 'Post not found');
  if (String(orig.author) === String(me)) return fail(res, 400, "You can't repost your own post");

  const existing = await Post.findOne({ author: me, repostOf: orig._id });
  let reposted;
  let delta = 0;
  if (existing) {
    await existing.deleteOne();
    reposted = false; delta = -1;
  } else {
    try {
      await Post.create({ author: me, type: orig.type, repostOf: orig._id });
      delta = 1;
    } catch (e) { if (e.code !== 11000) throw e; }
    reposted = true;
  }
  const updated = delta
    ? await Post.findByIdAndUpdate(orig._id, { $inc: { repostsCount: delta } }, { new: true })
    : orig;

  emitFeed('post:counts', countsOf(updated));
  if (delta === 1) {
    notifyUsers({ userIds: [orig.author], actor: me, type: 'repost', post: orig._id, verb: 'reposted your post' }).catch(console.error);
  }
  res.json({ reposted, repostsCount: updated.repostsCount });
};

export const share = async (req, res) => {
  const updated = await Post.findByIdAndUpdate(req.params.id, { $inc: { sharesCount: 1 } }, { new: true });
  if (!updated) return fail(res, 404, 'Post not found');
  emitFeed('post:counts', countsOf(updated));
  res.json({ sharesCount: updated.sharesCount });
};

/* ------------------------------ comments ------------------------------ */

const commentView = (c) => ({
  _id: String(c._id), postId: String(c.post), text: c.text, createdAt: c.createdAt, author: authorView(c.author),
});

export const listComments = async (req, res) => {
  const limit = 30;
  const filter = { post: req.params.id };
  if (req.query.cursor) filter.createdAt = { $lt: new Date(req.query.cursor) };
  const rows = await Comment.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS).lean();
  res.json({
    comments: rows.slice(0, limit).map(commentView),
    nextCursor: rows.length > limit ? rows[limit - 1].createdAt : null,
  });
};

export const addComment = async (req, res) => {
  const text = String(req.body.text ?? '').trim();
  if (!text || text.length > 500) return fail(res, 400, 'Comment must be 1–500 characters');
  const post = await Post.findById(req.params.id).select('author');
  if (!post) return fail(res, 404, 'Post not found');

  const c = await Comment.create({ post: post._id, author: req.user._id, text });
  const updated = await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } }, { new: true });
  const out = commentView(await c.populate('author', AUTHOR_FIELDS));

  emitPost(post._id, 'comment:new', { postId: String(post._id), comment: out });
  emitFeed('post:counts', countsOf(updated));
  notifyUsers({ userIds: [post.author], actor: req.user._id, type: 'comment', post: post._id, verb: 'commented on your post' }).catch(console.error);
  res.status(201).json({ comment: out });
};

export const deleteComment = async (req, res) => {
  const c = await Comment.findOne({ _id: req.params.commentId, post: req.params.id });
  if (!c) return fail(res, 404, 'Comment not found');
  const post = await Post.findById(c.post).select('author');
  const allowed = [String(c.author), String(post?.author)].includes(String(req.user._id));
  if (!allowed) return fail(res, 403, "You can't delete this comment");

  await c.deleteOne();
  const updated = await Post.findOneAndUpdate(
    { _id: c.post, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } }, { new: true }
  );
  emitPost(c.post, 'comment:deleted', { postId: String(c.post), commentId: String(c._id) });
  if (updated) emitFeed('post:counts', countsOf(updated));
  res.json({ ok: true });
};
