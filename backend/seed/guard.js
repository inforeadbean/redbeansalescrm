import Lead from "../models/Lead.js";
import IfoConversion from "../models/IfoConversion.js";
import User from "../models/User.js";

// Stops `seed:base` / `seed:demo` from silently destroying real work. If the
// database already holds leads, conversions, or more than the 3 starting
// accounts, the caller must pass CONFIRM_WIPE=yes.
export async function assertSafeToWipe(what) {
  if (process.env.CONFIRM_WIPE === "yes") return;

  const [leads, conversions, users] = await Promise.all([
    Lead.estimatedDocumentCount(),
    IfoConversion.estimatedDocumentCount(),
    User.estimatedDocumentCount(),
  ]);

  if (leads === 0 && conversions === 0 && users <= 3) return; // nothing to lose

  console.error(
    `\n⚠  This database has real data (${leads} leads, ${conversions} conversions, ${users} users).\n` +
      `   "${what}" would DELETE all of it.\n\n` +
      `   Re-run with CONFIRM_WIPE=yes if you're sure:\n` +
      `     CONFIRM_WIPE=yes npm run ${what}\n`
  );
  process.exit(1);
}
