import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB, stopMemoryServer } from "../config/db.js";
import { seedAdmin } from "./seedAdmin.js";

dotenv.config();

// One-time bootstrap for a persistent database (local mongod or Atlas):
// creates the very first Admin (MD) login. Not needed when USE_MEMORY_DB is
// on — server.js seeds that DB on every boot since it starts empty.
async function run() {
  const { usingMemory } = await connectDB();
  if (usingMemory) {
    console.log(
      "[Seed] In-memory DB in use — this would vanish on exit. " +
        "server.js already auto-seeds it on boot; nothing to do here."
    );
  } else {
    await seedAdmin();
  }

  await mongoose.disconnect();
  await stopMemoryServer();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
