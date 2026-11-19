// Lets controllers use async/await without try/catch.
export default (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const fail = (res, code, message) => res.status(code).json({ message });
