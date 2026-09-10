import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB, stopMemoryServer } from "../config/db.js";
import { seedBase } from "./seedBase.js";
import { assertSafeToWipe } from "./guard.js";
import User from "../models/User.js";
import Lead from "../models/Lead.js";
import Remark from "../models/Remark.js";
import Call from "../models/Call.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion from "../models/IfoConversion.js";
import Target from "../models/Target.js";

dotenv.config();

// `npm run seed:base` — wipe ALL data and reset to just the three starting
// accounts (admin, sales head, sales person). Use this to clear demo data off
// a persistent database. Refuses to run with NODE_ENV=production.
async function run() {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed:base] refusing to run with NODE_ENV=production");
    process.exit(1);
  }

  await connectDB();
  await assertSafeToWipe("seed:base");
  console.log("[seed:base] wiping every collection…");
  await Promise.all([
    Lead.deleteMany({}),
    Remark.deleteMany({}),
    Call.deleteMany({}),
    Webinar.deleteMany({}),
    Event.deleteMany({}),
    IfoConversion.deleteMany({}),
    Target.deleteMany({}),
    User.deleteMany({}),
  ]);

  await seedBase();

  console.log("\nLogins:");
  console.table([
    {
      role: "admin",
      email: process.env.SEED_ADMIN_EMAIL || "admin@redbeanhospitality.com",
      password: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
    },
    {
      role: "sales head",
      email: process.env.SEED_MANAGER_EMAIL || "saleshead@redbeanhospitality.com",
      password: process.env.SEED_MANAGER_PASSWORD || "Head@123",
    },
    {
      role: "sales person",
      email: process.env.SEED_SALES_EMAIL || "sales@redbeanhospitality.com",
      password: process.env.SEED_SALES_PASSWORD || "Sales@123",
    },
  ]);

  await mongoose.disconnect();
  await stopMemoryServer();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
