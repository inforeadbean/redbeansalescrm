import User from "../models/User.js";
import { seedAdmin } from "./seedAdmin.js";

// The minimal, real starting point: one admin, one sales head (manager), one
// sales person reporting to that head — and no sample data. This is what the
// server seeds on an empty boot. `npm run seed:demo` still exists if bulk
// demo data is wanted instead.
//
// CREATE-ONLY. Credentials come from .env (with fallbacks) and are used only
// when an account doesn't exist yet. Once an account exists its password
// belongs to the user — seeding never touches it, in any environment. (There
// used to be a dev-only "reconcile password back to .env" step; it silently
// undid password changes made in the app on every restart. Forgotten
// passwords are handled by the admin's "reset password" flow now, so the
// reconcile was removed 2026-09-10.)
export async function seedBase({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);

  await seedAdmin();

  const head = await upsert({
    email: process.env.SEED_MANAGER_EMAIL || "saleshead@redbeanhospitality.com",
    password: process.env.SEED_MANAGER_PASSWORD || "Head@123",
    name: "Sales Head",
    role: "manager",
  });

  await upsert({
    email: process.env.SEED_SALES_EMAIL || "sales@redbeanhospitality.com",
    password: process.env.SEED_SALES_PASSWORD || "Sales@123",
    name: "Sales Person",
    role: "salesperson",
    manager: head?._id,
  });

  log("[seed:base] admin + sales head + sales person ready (no sample data).");

  async function upsert({ email, password, name, role, manager }) {
    const e = email.toLowerCase().trim();
    const existing = await User.findOne({ email: e });
    if (existing) {
      log(`[seed:base] ${role} already exists: ${e}`);
      return existing;
    }
    const user = await User.create({ name, email: e, password, role, status: "active", manager });
    log(`[seed:base] ${role} created — ${e} / ${password}`);
    return user;
  }
}
