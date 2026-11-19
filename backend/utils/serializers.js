// Fields needed to render a person on a card. Adjust paths to match your User schema.
export const AUTHOR_FIELDS =
  'firstName lastName avatar roles seller.shopName seller.area address lga verification.status lastSeen';

export const authorView = (u) =>
  u && {
    _id: String(u._id),
    name:
      u.seller?.shopName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
      'SaveBite user',
    avatar: u.avatar?.url ?? (typeof u.avatar === 'string' ? u.avatar : null),
    area: u.seller?.area ?? u.address?.lga ?? u.lga ?? null,
    verified: u.verification?.status === 'verified',
    isSeller: !!u.roles?.includes('seller'),
    lastSeen: u.lastSeen ?? null,
  };

export const countsOf = (p) => ({
  postId: String(p._id),
  likes: p.likesCount,
  comments: p.commentsCount,
  reposts: p.repostsCount,
  shares: p.sharesCount,
});
