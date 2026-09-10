import User from "../models/User.js";

// Ensures the very first Admin (MD) login exists so there's a way into the
// app before the Sales Team module (which lets an admin create other users)
// is built. Assumes an open Mongoose connection — the caller owns
// connecting/disconnecting. Safe to run repeatedly: skips if the admin is
// already there. Called automatically on boot when the in-memory dev DB is
// in use (that DB is empty every restart), and by `npm run seed:admin`.
export async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@redbeanhospitality.com")
    .toLowerCase()
    .trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[Seed] Admin already exists: ${email}`);
    return;
  }

  await User.create({
    name: "Super Admin",
    email,
    password,
    role: "admin",
    status: "active",
  });
  console.log(`[Seed] Admin created — email: ${email} / password: ${password}`);
  console.log("[Seed] Change this password after first login.");
}
