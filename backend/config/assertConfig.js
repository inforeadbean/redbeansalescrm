// Fail fast on a misconfigured secret instead of booting an app that anyone can
// forge admin tokens for. `JWT_SECRET` is what signs every session — if it's
// missing, still the placeholder from .env.example, or too short to be a real
// random value, that's not a warning, it's a stop.
const PLACEHOLDERS = new Set([
  "change-this-to-a-long-random-string",
  "your-secret-key",
  "secret",
  "changeme",
]);

export function assertConfig() {
  const secret = process.env.JWT_SECRET || "";
  const problems = [];

  if (!secret) problems.push("JWT_SECRET is not set.");
  else if (PLACEHOLDERS.has(secret.trim()))
    problems.push("JWT_SECRET is still the example placeholder — generate a real one.");
  else if (secret.length < 32)
    problems.push(`JWT_SECRET is only ${secret.length} chars — use at least 32 (e.g. \`openssl rand -base64 48\`).`);

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    for (const [k, v] of Object.entries({
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
      SEED_MANAGER_PASSWORD: process.env.SEED_MANAGER_PASSWORD,
      SEED_SALES_PASSWORD: process.env.SEED_SALES_PASSWORD,
    })) {
      if (v && /^(Admin|Head|Sales)@123$/.test(v))
        problems.push(`${k} is still the documented default — change it before a real deployment.`);
    }
  }

  if (problems.length) {
    const msg =
      "[config] Refusing to start:\n" +
      problems.map((p) => `  • ${p}`).join("\n") +
      "\n  Generate a secret with:  node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"";
    // Thrown (not process.exit) so it works both for the standalone server —
    // which catches this and exits cleanly — and the Vercel function, where an
    // exit would hard-kill the runtime; there it surfaces as a 5xx + a log line.
    throw new Error(msg);
  }
}
