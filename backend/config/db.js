import mongoose from "mongoose";

// Held so a graceful shutdown (or the seed script) can stop the embedded
// mongod and release its data dir / port.
let memoryServer = null;

function isLocalUri(uri) {
  return !uri || /mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(uri);
}

// Spins up mongodb-memory-server: a real mongod the package downloads once
// (~50MB, cached under node_modules) and runs on a random port with an
// ephemeral data dir. Everything is gone when the process exits — hence the
// auto-seed on boot in server.js.
async function startMemoryServer() {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: "rbh_sales_crm" },
  });
  console.log("[DB] Using in-memory MongoDB — data resets on every restart.");
  return memoryServer.getUri("rbh_sales_crm");
}

// Opens the single shared connection at boot. Order of preference:
//   1. USE_MEMORY_DB=true            -> always the in-memory dev DB
//   2. MONGO_URI reachable           -> use it (local mongod or Atlas)
//   3. MONGO_URI is local but down   -> fall back to the in-memory dev DB
//   4. MONGO_URI is remote but down  -> hard error (likely a real misconfig)
// Returns { usingMemory } so the caller knows whether to auto-seed.
export async function connectDB() {
  const configuredUri = process.env.MONGO_URI;

  if (process.env.USE_MEMORY_DB === "true") {
    const uri = await startMemoryServer();
    const conn = await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return { usingMemory: true };
  }

  try {
    const conn = await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return { usingMemory: false };
  } catch (err) {
    if (!isLocalUri(configuredUri)) {
      console.error(`[DB] Connection failed: ${err.message}`);
      process.exit(1);
    }
    console.warn(
      `[DB] Local MongoDB not reachable (${err.message}).\n` +
        "[DB] Falling back to in-memory MongoDB. Set USE_MEMORY_DB=true to silence this,\n" +
        "[DB] or start a real MongoDB / point MONGO_URI at Atlas for persistent data."
    );
    const uri = await startMemoryServer();
    const conn = await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return { usingMemory: true };
  }
}

export async function stopMemoryServer() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
