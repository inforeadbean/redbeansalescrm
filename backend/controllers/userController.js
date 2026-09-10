import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/paginate.js";
import { userScope } from "../utils/scope.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import User from "../models/User.js";
import Lead from "../models/Lead.js";

const PUBLIC_FIELDS = "name email username phone role city state photoUrl status joiningDate manager createdAt";

// Normalise + validate an optional login handle. Returns "" to clear it, a
// clean string to set it, or throws a 400. Lowercase, 3-60 chars, starts
// alphanumeric, letters/digits/._- only, and never an email.
function cleanUsername(raw) {
  const u = String(raw ?? "").toLowerCase().trim();
  if (!u) return "";
  if (u.includes("@")) {
    const e = new Error("Username can't contain '@' — that looks like an email.");
    e.status = 400;
    throw e;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(u)) {
    const e = new Error("Username: 3-60 chars, letters/numbers/._- only, starting with a letter or number.");
    e.status = 400;
    throw e;
  }
  return u;
}

// A manager may only ever create/edit salespeople, and only ones reporting to
// them. Admin has no such limits.
function assertCanManage(actor, targetRole) {
  if (actor.role === "admin") return;
  if (actor.role === "manager" && targetRole === "salesperson") return;
  const err = new Error("Managers can only manage salespeople on their own team.");
  err.status = 403;
  throw err;
}

// @route  GET /api/users
// @access admin, manager, salesperson (scoped)
export const listUsers = asyncHandler(async (req, res) => {
  const scope = await userScope(req.user);
  const filter = { ...scope };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }, { city: rx }] }];
  }

  const result = await paginate(User, filter, {
    query: req.query,
    sort: "name",
    select: PUBLIC_FIELDS,
    populate: { path: "manager", select: "name email" },
  });
  res.json(result);
});

// @route  GET /api/users/team
// @access all — the assignable people for lead-owner dropdowns
export const getAssignable = asyncHandler(async (req, res) => {
  let filter;
  if (req.user.role === "admin") filter = { status: "active", role: { $in: ["salesperson", "manager"] } };
  else if (req.user.role === "manager")
    filter = { status: "active", $or: [{ manager: req.user._id }, { _id: req.user._id }] };
  else filter = { _id: req.user._id };

  const users = await User.find(filter).select("name role").sort("name").lean();
  res.json(users);
});

// @route  GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const scope = await userScope(req.user);
  const user = await User.findOne({ _id: req.params.id, ...scope })
    .select(PUBLIC_FIELDS)
    .populate("manager", "name email");
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  res.json(user);
});

// @route  POST /api/users
// @access admin, manager
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, city, state } = req.body;
  let { role, manager } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are required.");
  }

  // Managers can only mint salespeople, always reporting to themselves.
  if (req.user.role === "manager") {
    role = "salesperson";
    manager = req.user._id;
  } else {
    role = role || "salesperson";
    if (role === "salesperson" && !manager) manager = undefined;
  }
  assertCanManage(req.user, role);

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) {
    res.status(409);
    throw new Error("A user with this email already exists.");
  }

  const username = cleanUsername(req.body.username);
  if (username && (await User.findOne({ username }))) {
    res.status(409);
    throw new Error("That username is taken.");
  }

  const user = await User.create({
    name,
    email,
    username: username || undefined,
    password,
    phone,
    city,
    state,
    role,
    manager: role === "salesperson" ? manager : undefined,
  });

  const clean = await User.findById(user._id).select(PUBLIC_FIELDS).populate("manager", "name email");
  res.status(201).json(clean);
});

// @route  PUT /api/users/:id
// @access admin, manager (own team)
export const updateUser = asyncHandler(async (req, res) => {
  const scope = await userScope(req.user);
  const user = await User.findOne({ _id: req.params.id, ...scope }).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  assertCanManage(req.user, user.role);

  const { name, phone, city, state, photoUrl, password } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (city !== undefined) user.city = city;
  if (state !== undefined) user.state = state;
  if (photoUrl !== undefined) user.photoUrl = photoUrl;
  if (password) user.password = password; // re-hashed by the pre-save hook

  // Only an admin can change the login identifiers (email / username). Neither
  // breaks an active session (JWT carries the id) — they just change what the
  // person logs in with.
  if (req.user.role === "admin" && req.body.email !== undefined) {
    const email = String(req.body.email).toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400);
      throw new Error("Enter a valid email address.");
    }
    if (email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } });
      if (taken) {
        res.status(409);
        throw new Error("Another account already uses that email.");
      }
      user.email = email;
    }
  }
  if (req.user.role === "admin" && req.body.username !== undefined) {
    const username = cleanUsername(req.body.username);
    if (username !== (user.username || "")) {
      if (username && (await User.findOne({ username, _id: { $ne: user._id } }))) {
        res.status(409);
        throw new Error("That username is taken.");
      }
      if (username) user.username = username;
      else user.set("username", undefined); // $unset — keeps the sparse index clean
    }
  }

  // Only an admin may change role / reporting line, and never their own role.
  if (req.user.role === "admin" && String(user._id) !== String(req.user._id)) {
    if (req.body.role) user.role = req.body.role;
    if (req.body.manager !== undefined)
      user.manager = user.role === "salesperson" ? req.body.manager || undefined : undefined;
  }

  await user.save();
  const clean = await User.findById(user._id).select(PUBLIC_FIELDS).populate("manager", "name email");
  res.json(clean);
});

// A readable-enough one-time password (no look-alike chars).
function generatePassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// @route  POST /api/users/:id/reset-password   { password? }
// @access admin, manager (own team) — NOT for your own account
// Sets a new password and returns it in plain text ONCE (it's stored hashed,
// so this is the only moment anyone can read it — the admin copies it and
// hands it to the person, who changes it from Settings after logging in).
export const resetPassword = asyncHandler(async (req, res) => {
  const scope = await userScope(req.user);
  const user = await User.findOne({ _id: req.params.id, ...scope });
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  assertCanManage(req.user, user.role);
  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error("Use Settings → Change password for your own account.");
  }
  const custom = typeof req.body.password === "string" ? req.body.password.trim() : "";
  if (custom && custom.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters.");
  }
  const password = custom || generatePassword();
  user.password = password; // hashed by the pre-save hook
  await user.save();
  res.json({ name: user.name, email: user.email, username: user.username || "", password });
});

// @route  PATCH /api/users/:id/status   { status: "active" | "inactive" }
// @access admin, manager (own team)
export const setUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) {
    res.status(400);
    throw new Error("status must be 'active' or 'inactive'.");
  }
  if (String(req.params.id) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot change your own account status.");
  }

  const scope = await userScope(req.user);
  const user = await User.findOne({ _id: req.params.id, ...scope });
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  assertCanManage(req.user, user.role);

  user.status = status;
  await user.save();
  const clean = await User.findById(user._id).select(PUBLIC_FIELDS).populate("manager", "name email");
  res.json(clean);
});

// @route  DELETE /api/users/:id
// @access admin
export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot delete your own account.");
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  if (user.role === "admin") {
    const admins = await User.countDocuments({ role: "admin", status: "active" });
    if (admins <= 1) {
      res.status(400);
      throw new Error("Cannot delete the last active admin.");
    }
  }

  const openLeads = await Lead.countDocuments({ assignedTo: user._id });
  if (openLeads > 0) {
    res.status(400);
    throw new Error(
      `This user still owns ${openLeads} lead(s). Reassign them first, or deactivate the user instead.`
    );
  }

  await user.deleteOne();
  res.json({ message: "User deleted." });
});
