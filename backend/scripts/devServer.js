import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// `npm run dev` entry point.
//
// Runs ONE mongod for the whole dev session, on a fixed port, and hands its URI
// to a nodemon child via env — so nodemon can restart server.js freely without
// touching the database.
//
// The data dir is PERSISTENT (`backend/.mongo-data`), so everything you enter
// survives `npm run dev` restarts and machine reboots. It is NEVER wiped
// automatically — only `npm run seed:base` / `npm run seed:demo` clear it, and
// those now ask for confirmation once there's real data.

const PORT = Number(process.env.DEV_DB_PORT) || 27017;
const URI = `mongodb://127.0.0.1:${PORT}/rbh_sales_crm`;
const DATA_DIR = path.join(here, "..", ".mongo-data");

// One-time sweep of throwaway dirs left by older (non-persistent) runs.
function sweepStaleTmp() {
  const tmp = os.tmpdir();
  let freed = 0;
  for (const name of fs.readdirSync(tmp)) {
    if (!name.startsWith("mongo-mem-")) continue;
    try {
      fs.rmSync(path.join(tmp, name), { recursive: true, force: true });
      freed++;
    } catch {
      /* in use — skip */
    }
  }
  if (freed) console.log(`[dev] cleaned ${freed} stale mongo temp dir(s)`);
}

const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net
      .connect({ port, host: "127.0.0.1" }, () => {
        s.destroy();
        resolve(true);
      })
      .on("error", () => resolve(false));
    s.setTimeout(500, () => {
      s.destroy();
      resolve(false);
    });
  });

let mongod = null;

async function ensureMongo() {
  if (await portOpen(PORT)) {
    console.log(`[dev] using MongoDB already listening on :${PORT}`);
    return;
  }
  sweepStaleTmp();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    mongod = await MongoMemoryServer.create({
      instance: { port: PORT, dbName: "rbh_sales_crm", storageEngine: "wiredTiger", dbPath: DATA_DIR },
    });
    console.log(`[dev] MongoDB up on :${PORT} — data persists in backend/.mongo-data`);
  } catch (err) {
    console.error(`[dev] could not start MongoDB: ${err.message}`);
    console.error("[dev] if it mentions a lock, delete backend/.mongo-data/mongod.lock and retry.");
    process.exit(1);
  }
}

// Stop mongod but LEAVE the data on disk (doCleanup:false).
async function shutdown(code = 0) {
  try {
    await mongod?.stop({ doCleanup: false });
  } catch {
    /* ignore */
  }
  process.exit(code);
}

await ensureMongo();

// Spawn nodemon via its JS entry point with the current node binary — avoids
// the Windows `.cmd` shim, which Node 24 refuses to spawn without a shell.
const nodemonBin = require.resolve("nodemon/bin/nodemon.js");
const child = spawn(
  process.execPath,
  [nodemonBin, "--quiet", "--ignore", "scripts/", "--ignore", ".mongo-data/", path.join(here, "..", "server.js")],
  {
    stdio: "inherit",
    env: { ...process.env, MONGO_URI: URI, USE_MEMORY_DB: "false" },
  }
);

child.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => {
  child.kill("SIGINT");
  shutdown(0);
});
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  shutdown(0);
});
