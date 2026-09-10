import "dotenv/config";
import { assertConfig } from "./config/assertConfig.js";
import app from "./app.js";
import { connectDB, stopMemoryServer } from "./config/db.js";
import { seedBase } from "./seed/seedBase.js";
import { seedDemo } from "./seed/seedDemo.js";
import User from "./models/User.js";

// The server process: connect the DB, seed an empty one, then listen. In
// production `app.js` also serves the built frontend, so this one process is
// the whole deployment. Run via `npm run dev` (root) locally or `npm start`.

try {
  assertConfig(); // JWT_SECRET must be real; prod also rejects the default seed passwords
} catch (err) {
  console.error("\n" + err.message + "\n");
  process.exit(1);
}

await connectDB();

// On an empty boot, create the three real starting accounts (admin + sales head
// + sales person) and nothing else. `npm run dev` keeps one MongoDB alive for
// the whole session, so this runs once, not on every nodemon restart.
// Want a populated demo instead? set SEED_DEMO=true, or run `npm run seed:demo`.
if (process.env.SEED_DEMO === "true" && (await User.estimatedDocumentCount()) <= 1) {
  console.log("[Server] SEED_DEMO=true — loading the full demo dataset…");
  const t = Date.now();
  await seedDemo({ quiet: true });
  console.log(`[Server] demo data ready in ${((Date.now() - t) / 1000).toFixed(1)}s`);
} else {
  await seedBase();
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`[Server] RBH Sales CRM API running on port ${PORT}`)
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await stopMemoryServer();
      process.exit(0);
    });
  });
}
