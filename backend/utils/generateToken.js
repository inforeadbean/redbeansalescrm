import jwt from "jsonwebtoken";

// Signs a JWT carrying only the user id + role. Everything else about the
// user (name, status, etc.) is looked up fresh from the DB on every request
// (see middleware/authMiddleware.js) instead of being trusted from the
// token payload — so a role change or a deactivated account takes effect
// on the very next request instead of only once the old token expires.
export function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
