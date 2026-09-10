import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";

// Verifies the Bearer token on every protected request and attaches the
// fresh user document (password excluded by the schema's `select: false`)
// to req.user. Re-fetching the user on every request — rather than
// trusting the token's own payload — means a deactivated account or a
// role change by an admin takes effect on the very next request instead
// of only once the old token naturally expires.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401);
    throw new Error("Not authorized — no token provided.");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.status !== "active") {
      res.status(401);
      throw new Error("Not authorized — account not found or inactive.");
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized — invalid or expired token.");
  }
});

// Usage: router.get("/x", protect, authorize("admin", "manager"), handler).
// Must run AFTER protect — it reads req.user, which protect sets.
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error(`Role '${req.user?.role}' is not allowed to access this resource.`);
  }
  next();
};
