export default class ApiError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra; // e.g. { code: "SIGNUP_EXPIRED", errors: { phone: "..." } }
    this.isOperational = true;
  }
}
