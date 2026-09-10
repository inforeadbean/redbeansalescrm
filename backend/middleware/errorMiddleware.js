// 404 handler — mounted after every real route in server.js, so anything
// that didn't match a route falls through to here instead of Express's
// default plain-text 404.
export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler — every controller either throws or forwards an
// Error here via asyncHandler, so every error response comes back in the
// same {message} JSON shape instead of Express's default HTML error page.
export function errorHandler(err, req, res, next) {
  // Mongoose validation / bad-ObjectId errors are the client's fault → 400,
  // not a 500. A duplicate-key error (e.g. re-used email) → 409.
  let statusCode = err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Server error";
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})[0]?.message || "Invalid input.";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Malformed id.";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "That record already exists.";
  }

  const body = { message };
  if (process.env.NODE_ENV !== "production") body.stack = err.stack;
  res.status(statusCode).json(body);
}
