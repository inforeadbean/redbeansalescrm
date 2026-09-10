import { useEffect, useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { MdUploadFile, MdCheckCircle, MdError, MdDownload } from "react-icons/md";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { fmtDate } from "../../utils/format.js";
import { bulkCreateLeads } from "../../services/leadService.js";
import { getAssignable } from "../../services/userService.js";

// Bulk import from CSV / Excel. Recognised columns: name, contact no, location,
// remarks, created on — phone is the only one that matters. Header names are
// matched loosely; a file with no header row is read positionally in that order.
const FIELD_ALIASES = {
  name: ["name", "full name", "contact name", "lead name", "client name", "customer name", "person"],
  phone: ["phone", "contact", "contact no", "contact number", "mobile", "mobile no", "mobile number", "number", "phone number", "phone no", "ph", "whatsapp"],
  location: ["location", "city", "address", "area", "place", "town", "region", "state"],
  remarks: ["remark", "remarks", "note", "notes", "comment", "comments", "description", "detail", "details"],
  createdOn: ["created on", "created", "created date", "created at", "date", "lead date", "date added", "added", "added on", "entry date", "enquiry date", "enquiry on"],
};
const POSITIONAL = ["name", "phone", "location", "remarks", "createdOn"];

const norm = (h) => String(h ?? "").toLowerCase().replace(/[._\-/]/g, " ").replace(/\s+/g, " ").trim();

// Last 10 digits — matches the backend, so "+91 98765 43210" and "098765-43210"
// are the same lead.
const phoneKey = (p) => String(p ?? "").replace(/\D/g, "").slice(-10);

// Parse a date cell from the import file. Handles JS Date objects (Excel),
// Excel serial numbers, dd/mm/yyyy (day-first — this CRM is India-only),
// yyyy-mm-dd and anything Date() understands ("15 Jan 2026"). A trailing
// time ("2026-01-16 06:24", "16/01/2026 6:24 PM") is dropped — leads are
// bucketed by calendar day. Returns a Date or null; null means "use today".
function parseImportDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip a trailing clock time so the date matchers below see just the date.
  s = s.replace(/[ T]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm)?$/i, "").trim();

  // Excel serial number (days since 1899-12-30)
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy  (day-first)
  let m = s.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2,4})$/);
  if (m) {
    let dd = +m[1], mm = +m[2], yy = +m[3];
    if (yy < 100) yy += yy < 50 ? 2000 : 1900;
    if (mm > 12 && dd <= 12) [dd, mm] = [mm, dd]; // clearly mm/dd
    const d = new Date(yy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // yyyy-mm-dd / yyyy/mm/dd
  m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toRecords(grid) {
  const clean = grid.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (!clean.length) return [];
  const header = clean[0].map(norm);
  const cols = {};
  header.forEach((h, idx) => {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (cols[field] == null && aliases.includes(h)) cols[field] = idx;
    }
  });
  const hasHeader = Object.keys(cols).length > 0;
  const body = hasHeader ? clean.slice(1) : clean;
  const at = (row, field, pos) => {
    const idx = hasHeader ? cols[field] : pos;
    return idx == null ? "" : String(row[idx] ?? "").trim();
  };
  const rawAt = (row, field, pos) => {
    const idx = hasHeader ? cols[field] : pos;
    return idx == null ? "" : row[idx];
  };
  return body
    .map((row) => {
      const d = parseImportDate(rawAt(row, "createdOn", 4));
      return {
        name: at(row, "name", 0),
        phone: at(row, "phone", 1),
        location: at(row, "location", 2),
        remarks: at(row, "remarks", 3),
        createdAt: d ? d.toISOString() : "",
      };
    })
    .filter((r) => r.name || r.phone || r.location || r.remarks);
}


export default function ImportLeadsModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const canAssign = user.role !== ROLES.SALESPERSON;

  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [people, setPeople] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } while importing

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setRows([]);
    setAssignedTo("");
    setProgress(null);
    if (canAssign) getAssignable().then(setPeople).catch(() => {});
  }, [open, canAssign]);

  // Rows repeated within the file (2nd+ occurrence of a phone) — the backend
  // skips these; flag them here so the count isn't a surprise. Duplicates of
  // leads already in the CRM can only be found server-side and are reported
  // after the import runs.
  const fileDupes = useMemo(() => {
    const seen = new Set();
    const dupes = new Set();
    rows.forEach((r, i) => {
      const k = phoneKey(r.phone);
      if (!k) return;
      if (seen.has(k)) dupes.add(i);
      else seen.add(k);
    });
    return dupes;
  }, [rows]);

  const valid = useMemo(
    () => rows.filter((r, i) => r.phone.trim() && !fileDupes.has(i)),
    [rows, fileDupes]
  );
  const noPhone = rows.filter((r) => !r.phone.trim()).length;

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    try {
      let grid;
      if (/\.xlsx?$/i.test(file.name)) {
        let parsed = await readXlsxFile(file);
        // read-excel-file may hand back a plain rows array or [{ sheet, data }]
        if (parsed[0] && !Array.isArray(parsed[0]) && Array.isArray(parsed[0].data)) {
          parsed = parsed[0].data;
        }
        grid = parsed.map((r) => r.map((c) => (c == null ? "" : c)));
      } else {
        grid = parseCSV(await file.text());
      }
      const recs = toRecords(grid);
      if (!recs.length) toast.error("Couldn't find any rows in that file.");
      setRows(recs);
    } catch (err) {
      toast.error("Couldn't read that file — is it a valid CSV or Excel file?");
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    if (!valid.length) return toast.error("No rows with a phone number to import.");
    setBusy(true);
    setProgress(rows.length > 500 ? { done: 0, total: rows.length } : null);
    try {
      const res = await bulkCreateLeads(
        rows.map((r) => ({
          name: r.name,
          phone: r.phone,
          location: r.location,
          remarks: r.remarks,
          createdAt: r.createdAt || undefined,
        })),
        canAssign ? assignedTo || undefined : undefined,
        (done, total) => setProgress({ done, total })
      );
      const dupes = res.skipped?.filter((s) => s.type === "duplicate").length || 0;
      const blank = res.skipped?.filter((s) => s.type === "no_phone").length || 0;
      toast.success(
        `Imported ${res.created} lead${res.created === 1 ? "" : "s"}.` +
          (res.skippedCount
            ? ` Skipped ${res.skippedCount} — ${blank} without a phone, ${dupes} duplicate${
                dupes === 1 ? "" : "s"
              }.`
            : "")
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import leads"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid.length}>
            {busy
              ? progress
                ? `Importing… ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
                : "Importing…"
              : `Import ${valid.length ? valid.length.toLocaleString() : ""} lead${
                  valid.length === 1 ? "" : "s"
                }`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-primary-light/30 border border-primary-light px-3 py-2.5 text-sm text-gray-600">
          <p className="font-medium text-gray-700">New list? Start from a template.</p>
          <p className="text-xs mt-0.5">
            Download it, type your leads under the header row (delete the example rows), and upload —
            columns are <b>name</b>, <b>contact&nbsp;no</b>, <b>location</b>, <b>remarks</b>,{" "}
            <b>created&nbsp;on</b>. Only the phone number is required; <b>created&nbsp;on</b> (e.g.{" "}
            <code>15/01/2026</code> or <code>2026-01-15</code>, with or without a time) backdates the
            lead so it counts toward that month — leave it blank for today.
          </p>
          <div className="flex gap-2 mt-2">
            <a
              href="/rbh-leads-template.xlsx"
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary"
            >
              <MdDownload size={13} /> Excel template
            </a>
            <a
              href="/rbh-leads-template.csv"
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary"
            >
              <MdDownload size={13} /> CSV template
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary-light/20 transition px-4 py-6 text-center"
        >
          <MdUploadFile size={26} className="mx-auto text-gray-400" />
          <span className="block text-sm text-gray-600 mt-1">
            {fileName ? <b>{fileName}</b> : "Choose a CSV or Excel file"}
          </span>
          <span className="block text-xs text-gray-400">{parsing ? "Reading…" : "click to browse"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={pickFile}
        />

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <MdCheckCircle size={16} /> {valid.length} ready
              </span>
              {noPhone > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <MdError size={16} /> {noPhone} without a phone
                </span>
              )}
              {fileDupes.size > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <MdError size={16} /> {fileDupes.size} duplicate{fileDupes.size === 1 ? "" : "s"} in file
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              Rows without a phone or repeated in the file are skipped. Leads already in the CRM (any
              salesperson) are matched by phone and skipped too — you'll get the exact count after import.
            </p>

            <div className="max-h-52 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Name</th>
                    <th className="text-left px-2 py-1.5 font-medium">Phone</th>
                    <th className="text-left px-2 py-1.5 font-medium">Location</th>
                    <th className="text-left px-2 py-1.5 font-medium">Remarks</th>
                    <th className="text-left px-2 py-1.5 font-medium">Created on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 50).map((r, i) => {
                    const skip = !r.phone.trim() || fileDupes.has(i);
                    return (
                      <tr key={i} className={skip ? "bg-amber-50/60 text-gray-400" : ""}>
                        <td className="px-2 py-1 whitespace-nowrap">{r.name || "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {r.phone || "missing"}
                          {fileDupes.has(i) && <span className="text-amber-600"> · duplicate</span>}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">{r.location || "—"}</td>
                        <td className="px-2 py-1 max-w-[180px] truncate" title={r.remarks}>{r.remarks || "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {r.createdAt ? fmtDate(r.createdAt) : <span className="text-gray-400">today</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && (
              <p className="text-xs text-gray-400 -mt-2">Showing first 50 of {rows.length} rows.</p>
            )}

            {canAssign && (
              <Select
                label="Assign all to"
                placeholder="— Me —"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                options={people.map((p) => ({ value: p._id, label: p.name }))}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
