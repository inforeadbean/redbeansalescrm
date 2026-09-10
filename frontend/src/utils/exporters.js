import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Trigger a browser download of `text` as a file.
function download(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// rows: array of objects. columns: [{ key, header }]. Values are stringified;
// anything containing a comma/quote/newline is quoted per RFC 4180.
export function exportCSV(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map((c) => esc(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")),
  ];
  download(filename, lines.join("\r\n"), "text/csv;charset=utf-8");
}

// A styled one-page-ish PDF: title, subtitle, then an autoTable. `foot` is an
// optional totals row (array of cell strings).
export function exportPDF({ filename, title, subtitle, columns, rows, foot }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor("#C1121F");
  doc.text(title, 40, 42);
  if (subtitle) {
    doc.setFontSize?.(10);
    doc.setFontSize(10);
    doc.setTextColor("#6B7280");
    doc.text(subtitle, 40, 60);
  }

  autoTable(doc, {
    startY: 74,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => r[c.key])),
    foot: foot ? [foot] : undefined,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: "#C1121F", textColor: "#FFFFFF" },
    footStyles: { fillColor: "#FDE7E9", textColor: "#8A0F19", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#FBF7F7" },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}
