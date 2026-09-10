// Regenerates the downloadable import templates in public/ —
//   public/rbh-leads-template.csv
//   public/rbh-leads-template.xlsx
// Run from the frontend folder:  node scripts/gen-lead-templates.mjs
// (write-excel-file is a devDependency, used only here.)
import { writeFileSync } from "node:fs";
import writeXlsxFile from "write-excel-file/node";

// `created on` backdates the lead so it counts toward the month it actually
// came in (dashboards/reports bucket leads by that date). Day-first dd/mm/yyyy —
// this CRM is India-only. Leave it blank for "today", as the last row shows.
const HEADER = ["name", "contact no", "location", "remarks", "created on"];
const EXAMPLES = [
  ["Ravi Kumar", "9812345678", "Mumbai", "Met at the food expo - keen on IFO", "15/01/2026"],
  ["Anita Shah", "9820011223", "Pune", "Asked for a callback next week", "03/02/2026"],
  ["Deepak Rao", "9890033445", "Bengaluru", "Referred by an existing client", ""],
];

writeFileSync(
  "public/rbh-leads-template.csv",
  [HEADER, ...EXAMPLES].map((r) => r.join(",")).join("\n") + "\n"
);

await writeXlsxFile(
  [
    HEADER.map((value) => ({ value, fontWeight: "bold" })),
    ...EXAMPLES.map((r) =>
      r.map((value) => (value === "" ? { value: null } : { value, type: String }))
    ),
  ],
  {
    columns: [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 44 }, { width: 14 }],
    sheet: "Leads",
  }
).toFile("public/rbh-leads-template.xlsx");

console.log("wrote public/rbh-leads-template.{csv,xlsx}");
