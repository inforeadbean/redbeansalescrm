import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB, stopMemoryServer } from "../config/db.js";
import { seedDemo } from "./seedDemo.js";
import { assertSafeToWipe } from "./guard.js";

dotenv.config();

// `npm run seed:demo` — replaces the database with the full demo dataset (10
// salespeople, ~1k leads, etc.) while keeping the 3 real starting accounts.
// Refuses to run with NODE_ENV=production, and asks for confirmation if the DB
// already has real data.
async function run() {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed:demo] refusing to run with NODE_ENV=production");
    process.exit(1);
  }

  const { usingMemory } = await connectDB();
  await assertSafeToWipe("seed:demo");
  console.log("[seed:demo] seeding… (this replaces all data)");
  const { summary, logins } = await seedDemo();

  console.log("\n=== demo data seeded ===");
  console.table(summary);
  console.log("\nLogins — password for every seeded user is  Test@123");
  console.table([
    {
      role: "admin",
      email: process.env.SEED_ADMIN_EMAIL || "admin@redbeanhospitality.com",
      password: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
    },
    ...logins.map((l) => ({ ...l, password: "Test@123" })),
  ]);

  if (usingMemory) {
    console.log(
      "\n⚠  This was the in-memory DB in a throwaway process — the data is already gone.\n" +
        "   Run the backend with USE_MEMORY_DB=true and it seeds itself on boot,\n" +
        "   or point MONGO_URI at a real database and re-run this."
    );
  }

  await mongoose.disconnect();
  await stopMemoryServer();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
