import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";

// The one shape the frontend's `user` object ever takes — same from /login,
// /me and PUT /me, so `user.id` is always there (never a raw `_id` doc).
const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  username: u.username || "",
  phone: u.phone,
  role: u.role,
  city: u.city,
  state: u.state,
  photoUrl: u.photoUrl,
  status: u.status,
  joiningDate: u.joiningDate,
});

// @route  POST /api/auth/login
// @access Public
// There is deliberately no public "register" endpoint — this is an
// internal company CRM, not a self-signup product. New logins are created
// by an Admin/Manager through the Sales Team module (see userController),
// or bootstrapped once via `npm run seed:admin`.
export const login = asyncHandler(async (req, res) => {
  // The field is still called `email` on the wire, but its value may be an
  // email OR a username — you can sign in with either.
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email/username and password are required.");
  }

  const id = String(email).toLowerCase().trim();
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid login or password.");
  }
  if (user.status !== "active") {
    res.status(403);
    throw new Error("This account has been deactivated. Contact your admin.");
  }

  res.json({ token: generateToken(user), user: publicUser(user) });
});

// @route  GET /api/auth/me
// @access Private
// Called once on app load so a token surviving in localStorage doesn't get
// trusted blindly — the frontend uses this to confirm it's still valid and
// to refresh the user's profile (name/role/photo) on every reload.
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// @route  POST /api/auth/logout
// @access Private
// JWTs are stateless, so there is nothing to invalidate server-side today —
// this endpoint exists so the frontend has one consistent call to make on
// logout, and so a token-blacklist can be added later without changing the
// API shape.
export const logout = asyncHandler(async (req, res) => {
  res.json({ message: "Logged out successfully." });
});

// @route  PUT /api/auth/me
// @access Private — a user editing their own profile (name/phone/city/photo).
// Role, email, status and manager are deliberately not editable here — those
// are admin actions through the Sales Team module.
export const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, phone, city, state, photoUrl } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (city !== undefined) user.city = city;
  if (state !== undefined) user.state = state;
  if (photoUrl !== undefined) user.photoUrl = photoUrl;
  await user.save();
  res.json({ user: publicUser(user) });
});

// @route  POST /api/auth/change-password
// @access Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current and new password are both required.");
  }
  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters.");
  }
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect.");
  }
  user.password = newPassword; // re-hashed by the pre-save hook
  await user.save();
  res.json({ message: "Password updated." });
});
