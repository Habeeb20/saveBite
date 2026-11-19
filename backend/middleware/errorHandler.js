import ApiError from "../utils/ApiError.js";

export const notFound = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  // Our own errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, ...err.extra });
  }

  // Mongoose validation -> { errors: { field: "message" } }
  if (err.name === "ValidationError") {
    const errors = {};
    Object.entries(err.errors).forEach(([path, e]) => (errors[path] = e.message));
    return res
      .status(422)
      .json({ success: false, message: Object.values(errors)[0] || "Invalid data", errors });
  }

  // Duplicate key (unique index)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
    const label = field === "phone" ? "phone number" : field;
    return res.status(409).json({
      success: false,
      message: `This ${label} is already registered`,
      errors: { [field]: `This ${label} is already registered` },
    });
  }

  // Bad JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON in request body" });
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
  });
};
