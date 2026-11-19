import IdempotencyKey from "../models/idempotency.js";

// Offline writes are replayed later, sometimes after the first try actually reached the server.
// The phone sends the same X-Idempotency-Key on every retry; we run the request once and
// answer every repeat with the saved response.
export default async function idempotency(req, res, next) {
  const key = req.get("X-Idempotency-Key");
  const uid = req.user && String(req.user._id || req.user.id || "");
  if (!key || !uid || req.method === "GET") return next();

  const id = `${uid}:${key}`.slice(0, 200);
  try {
    const hit = await IdempotencyKey.findById(id).lean();
    if (hit) {
      if (hit.status) return res.status(hit.status).json(hit.body);
      if (Date.now() - new Date(hit.createdAt).getTime() < 60000) {
        return res.status(503).json({ message: "Request is still being processed" });
      }
      await IdempotencyKey.updateOne({ _id: id }, { createdAt: new Date() }); // stale: take over
    } else {
      await IdempotencyKey.create({ _id: id });
    }
  } catch (e) {
    if (e.code === 11000) return res.status(503).json({ message: "Request is still being processed" });
    return next(e);
  }

  const json = res.json.bind(res);
  res.json = (body) => {
    IdempotencyKey.updateOne({ _id: id }, { status: res.statusCode, body }).catch(() => {});
    return json(body);
  };
  res.on("finish", () => {
    if (res.statusCode >= 500) IdempotencyKey.deleteOne({ _id: id }).catch(() => {});
  });
  next();
}