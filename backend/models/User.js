import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Represents every login in the system — Admin (MD), Sales Manager, and
// Sales Person all share this one collection, distinguished by `role`.
// Per-salesperson monthly targets live in their own `Target` collection
// (one salesperson can have a different target every month), not here.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    // Optional short login handle — a person can sign in with EITHER this or
    // their email. `sparse` so the many users without one don't collide;
    // never write `null` here (omit the field instead) or sparse won't skip it.
    username: { type: String, trim: true, lowercase: true, maxlength: 60, unique: true, sparse: true },
    phone: { type: String, trim: true, maxlength: 40 },
    // select:false keeps the hash out of every normal query result — code
    // that actually needs to compare a password must opt in with
    // .select("+password"), so a stray `res.json(user)` can never leak it.
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["admin", "manager", "salesperson"],
      default: "salesperson",
    },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    photoUrl: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    joiningDate: { type: Date, default: Date.now },
    // Which manager a salesperson reports to. Drives the "my team" scoping —
    // a manager sees only leads/calls/targets of users whose `manager` is
    // them (plus their own). Null for admins and managers themselves.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

// Hash the password whenever it's set or changed. Skipped when the
// password field wasn't touched (e.g. an admin editing just the city on an
// existing user) so an already-hashed password never gets re-hashed into
// gibberish that can never match again.
userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
