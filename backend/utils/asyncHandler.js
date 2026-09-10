// Wraps an async route/middleware handler so a rejected promise is passed
// to Express's error middleware via next(err) instead of crashing the
// process — without this, every controller would need its own try/catch
// just to forward errors.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
