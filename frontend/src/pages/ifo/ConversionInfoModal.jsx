import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MdAdd, MdHistory, MdOpenInNew, MdEventRepeat } from "react-icons/md";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CONVERSION_TYPE } from "../../utils/constants.js";
import { inr, fmtDate, fmtDateTime, fromNow, pct } from "../../utils/format.js";
import { getIfo, addPayment, updateIfo } from "../../services/ifoService.js";

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// The (i) history view for a conversion: money summary + full payment log +
// an inline "record a payment" form. All remarks live on the lead timeline —
// there's a link through to it.
export default function ConversionInfoModal({ open, onClose, conversionId, onChanged }) {
  const toast = useToast();
  const [ifo, setIfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextAmount, setNextAmount] = useState("");
  const [nextNote, setNextNote] = useState("");
  // The "when's the NEXT one due" the payment form asks for — kept separate
  // from the schedule editor above so it starts blank and is a conscious choice.
  const [payNextDate, setPayNextDate] = useState("");
  const [payNextAmount, setPayNextAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!conversionId) return;
    setLoading(true);
    try {
      const data = await getIfo(conversionId);
      setIfo(data);
      setNextDate(iso(data.nextInstallmentDate));
      setNextAmount(data.nextInstallmentAmount || "");
      setNextNote(data.nextInstallmentNote || "");
    } catch (err) {
      toast.error(err);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [conversionId, onClose, toast]);

  // Fetch only when the modal opens (or the conversion changes) — `load`'s
  // identity shifts every parent render (it closes over `onClose`), and the lead
  // page polls in the background; depending on `load` here would re-fetch and
  // wipe the payment / schedule fields the user is filling in.
  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setPayNextDate("");
      setPayNextAmount("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversionId]);

  const record = async () => {
    const a = Number(amount);
    if (!a || a <= 0) return toast.error("Enter a payment amount.");
    const willOwe = (ifo?.dealValue || 0) - (ifo?.amountReceived || 0) - a;
    if (willOwe > 0 && !payNextDate) {
      return toast.error(
        `${inr(willOwe)} will still be owed — set the next due date (an approximate one is fine).`
      );
    }
    setBusy(true);
    try {
      await addPayment(conversionId, {
        amount: a,
        note: note.trim() || undefined,
        // The payment form's own next-due fields drive the reminder now. If the
        // deal is fully paid off, no date needed — backend clears the schedule.
        nextInstallmentDate: payNextDate || undefined,
        nextInstallmentAmount: Number(payNextAmount) || undefined,
      });
      toast.success("Payment recorded.");
      setAmount("");
      setNote("");
      setPayNextDate("");
      setPayNextAmount("");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    setBusy(true);
    try {
      await updateIfo(conversionId, {
        nextInstallmentDate: nextDate || "",
        nextInstallmentAmount: Number(nextAmount) || "",
        nextInstallmentNote: nextNote.trim(),
      });
      toast.success(nextDate ? "Instalment date saved." : "Instalment schedule cleared.");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const received = ifo?.amountReceived || 0;
  const deal = ifo?.dealValue || 0;
  const outstanding = deal - received;
  const p = pct(received, deal);
  const nextOverdue = ifo?.nextInstallmentDate && new Date(ifo.nextInstallmentDate) < new Date();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        ifo ? (
          <span className="flex items-center gap-2">
            {ifo.outletName}
            <Badge color={CONVERSION_TYPE[ifo.conversionType]?.color}>
              {CONVERSION_TYPE[ifo.conversionType]?.label}
            </Badge>
          </span>
        ) : (
          "Conversion"
        )
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading || !ifo ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {/* summary */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Deal value" value={inr(deal)} />
            <Stat label="Received" value={inr(received)} accent="text-green-600" />
            <Stat label="Outstanding" value={inr(outstanding)} accent={outstanding > 0 ? "text-amber-600" : "text-gray-500"} />
          </div>
          <div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${p >= 100 ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, p)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {p}% collected · closed by {ifo.convertedBy?.name} on {fmtDate(ifo.conversionDate)}
              {ifo.lead && (
                <>
                  {" · "}
                  <Link to={`/leads/${ifo.lead._id}`} onClick={onClose} className="text-primary hover:underline inline-flex items-center gap-0.5">
                    lead timeline <MdOpenInNew size={12} />
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* next instalment schedule */}
          {outstanding > 0 && (
            <div className={`rounded-lg border p-3 ${nextOverdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
              <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                <MdEventRepeat size={16} className="text-gray-400" /> Next instalment
              </p>
              {ifo.nextInstallmentDate ? (
                <p className={`text-xs mb-2 ${nextOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                  {nextOverdue ? "Was due" : "Due"} {fmtDate(ifo.nextInstallmentDate)} ({fromNow(ifo.nextInstallmentDate)})
                  {ifo.nextInstallmentAmount ? ` · ${inr(ifo.nextInstallmentAmount)}` : ""}
                  {ifo.nextInstallmentNote ? ` — ${ifo.nextInstallmentNote}` : ""}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mb-2">Not scheduled. Set a date and the owner gets a reminder.</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="block text-xs text-gray-500 mb-1">Due date</span>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-xs text-gray-500 mb-1">Amount (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={nextAmount}
                    onChange={(e) => setNextAmount(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <label className="text-sm flex-1 min-w-[140px]">
                  <span className="block text-xs text-gray-500 mb-1">Remark</span>
                  <input
                    value={nextNote}
                    onChange={(e) => setNextNote(e.target.value)}
                    placeholder="e.g. confirmed on call"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <Button variant="secondary" onClick={saveSchedule} disabled={busy}>
                  {ifo.nextInstallmentDate && !nextDate ? "Clear" : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* record a payment */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-800 mb-2">Record a payment</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">Amount received (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="text-sm flex-1 min-w-[140px]">
                <span className="block text-xs text-gray-500 mb-1">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 2nd instalment"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            {/* the next one — asked right here so the chase-reminder never gets lost */}
            {(() => {
              const willOwe = outstanding - (Number(amount) || 0);
              if (willOwe <= 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">
                    {inr(willOwe)} still owed after this — when's the next payment due?
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      <span className="block text-xs text-gray-500 mb-1">Next due date</span>
                      <input
                        type="date"
                        value={payNextDate}
                        onChange={(e) => setPayNextDate(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-gray-500 mb-1">Amount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        value={payNextAmount}
                        onChange={(e) => setPayNextAmount(e.target.value)}
                        placeholder={String(willOwe)}
                        className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    {payNextDate
                      ? "The owner gets a reminder on this date."
                      : "Not sure exactly? Put an approximate date — you can change it anytime."}
                  </p>
                </div>
              );
            })()}

            <div className="mt-3">
              <Button onClick={record} disabled={busy}>
                <MdAdd size={16} /> Record payment
              </Button>
            </div>
          </div>

          {/* history */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <MdHistory size={16} className="text-gray-400" /> Payment history
            </p>
            {ifo.payments?.length ? (
              <ul className="divide-y divide-gray-50 border border-gray-100 rounded-lg">
                {[...ifo.payments].reverse().map((pmt) => (
                  <li key={pmt._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <span className="font-semibold text-green-600">{inr(pmt.amount)}</span>
                      {pmt.note && <span className="text-gray-500"> · {pmt.note}</span>}
                      {pmt.delayDays > 0 && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-semibold">
                          {pmt.delayDays}d late
                        </span>
                      )}
                      <p className="text-xs text-gray-400">
                        {fmtDateTime(pmt.createdAt)} · {pmt.recordedBy?.name || "—"}
                        {pmt.dueDate && ` · was due ${fmtDate(pmt.dueDate)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No payments recorded yet.</p>
            )}
          </div>

          {ifo.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{ifo.notes}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, accent = "text-gray-800" }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
