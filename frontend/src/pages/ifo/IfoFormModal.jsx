import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Textarea, FieldShell } from "../../components/ui/Field.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import LeadPicker from "../../components/LeadPicker.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { inrCompact } from "../../utils/format.js";
import { createIfo, updateIfo } from "../../services/ifoService.js";

// Today as yyyy-mm-dd in the user's own timezone (not UTC — toISOString() would
// roll back a day for anyone recording a conversion after ~midnight local).
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Create (record a conversion) or edit its details. On create it always asks
// how much has been paid so far — that becomes the first payment entry.
// Editing here is for correcting the record; payments are logged separately
// via the (i) history modal.
export default function IfoFormModal({ open, onClose, onSaved, ifo, presetLead }) {
  const toast = useToast();
  const { options: typeOptions, byCode: typesByCode } = useConversionTypes();
  const editing = !!ifo;
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState({});
  const [valueTouched, setValueTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  // Converting is a one-way door for a salesperson (only a manager can reverse
  // it). When the flow was kicked off from a stage change / Kanban drop, make
  // them confirm before the form opens so a stray click can't create a sale.
  const [confirmed, setConfirmed] = useState(false);

  // Initialise the form only when the modal opens (or the target conversion
  // changes) — NOT on every re-render of the parent. The lead detail page polls
  // in the background, which re-creates the `presetLead` object; reacting to
  // that identity change here would wipe whatever the user just typed (e.g.
  // resetting the type back to IFO).
  useEffect(() => {
    if (!open) return;
    setConfirmed(false);
    setLead(
      ifo?.lead
        ? { _id: ifo.lead._id, name: ifo.lead.name }
        : presetLead
        ? { _id: presetLead._id, name: presetLead.name }
        : null
    );
    const type = ifo?.conversionType || "ifo";
    setForm({
      conversionType: type,
      dealValue: ifo?.dealValue ?? typesByCode[type]?.defaultValue ?? 0,
      amountPaid: 0,
      conversionDate: ifo?.conversionDate ? ifo.conversionDate.slice(0, 10) : todayLocal(),
      notes: ifo?.notes || "",
      nextInstallmentDate: "",
      nextInstallmentAmount: "",
      nextInstallmentNote: "",
    });
    setValueTouched(editing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ifo?._id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setType = (conversionType) => {
    setForm((f) => ({
      ...f,
      conversionType,
      dealValue: valueTouched ? f.dealValue : typesByCode[conversionType]?.defaultValue ?? f.dealValue,
    }));
  };

  const submit = async () => {
    if (!editing && !lead) return toast.error("Pick the lead being converted.");
    setBusy(true);
    try {
      const payload = { ...form, dealValue: Number(form.dealValue) || 0 };
      if (editing) {
        // schedule + payment fields are managed from the (i) history modal
        for (const k of ["amountPaid", "nextInstallmentDate", "nextInstallmentAmount", "nextInstallmentNote"])
          delete payload[k];
        await updateIfo(ifo._id, payload);
      } else {
        await createIfo({
          ...payload,
          amountPaid: Number(form.amountPaid) || 0,
          nextInstallmentAmount: Number(form.nextInstallmentAmount) || undefined,
          lead: lead._id,
        });
      }
      toast.success(editing ? "Conversion updated." : "Conversion recorded — lead marked won.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const type = form.conversionType || "ifo";
  const outstanding = (Number(form.dealValue) || 0) - (Number(form.amountPaid) || 0);
  const needsConfirm = !editing && !!presetLead && !confirmed;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={needsConfirm ? "Convert this lead?" : editing ? "Edit conversion details" : "Record conversion"}
      size={needsConfirm ? "sm" : undefined}
      footer={
        needsConfirm ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => setConfirmed(true)} disabled={busy}>
              Yes, record a sale
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save" : "Record conversion"}
            </Button>
          </>
        )
      }
    >
      {needsConfirm ? (
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            This marks <b className="text-gray-900">{presetLead.name}</b>
            {presetLead.restaurantName ? ` (${presetLead.restaurantName})` : ""} as a paying client.
          </p>
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
            Once recorded, you can’t move this lead again or undo the sale yourself — only a manager can
            reverse a conversion. Make sure the deal is actually closed.
          </p>
        </div>
      ) : (
      <div className="space-y-4">
        {!editing && !presetLead && (
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Lead</span>
            <LeadPicker value={lead} onChange={setLead} placeholder="Which lead converted…" />
          </div>
        )}
        {!editing && presetLead && (
          <p className="text-sm text-gray-500">
            Converting <b className="text-gray-800">{presetLead.name}</b>
            {presetLead.restaurantName ? ` — ${presetLead.restaurantName}` : ""}.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <FieldShell
            label="Conversion type"
            hint={
              typesByCode[type]
                ? `Standard ${typesByCode[type].label} value: ${inrCompact(typesByCode[type].defaultValue)}`
                : "Add more types from Settings."
            }
          >
            <Listbox value={type} onChange={setType} options={typeOptions} placeholder="Choose a type…" />
          </FieldShell>
          <Input
            label="Deal value (₹)"
            type="number"
            min="0"
            value={form.dealValue ?? ""}
            onChange={(e) => {
              setValueTouched(true);
              set("dealValue")(e);
            }}
          />
          <Input label="Conversion date" type="date" value={form.conversionDate || ""} onChange={set("conversionDate")} />
        </div>

        {!editing && (
          <div className="rounded-lg bg-primary-light/40 border border-primary-light p-3 space-y-3">
            <Input
              label="How much have they paid so far? (₹)"
              type="number"
              min="0"
              value={form.amountPaid ?? 0}
              onChange={set("amountPaid")}
              hint={
                Number(form.amountPaid) > 0
                  ? outstanding > 0
                    ? `${inrCompact(outstanding)} still outstanding`
                    : outstanding < 0
                    ? "More than the deal value"
                    : "Fully paid"
                  : "Enter 0 if nothing has been received yet — add instalments later."
              }
            />
            {outstanding > 0 && (
              <div className="border-t border-primary-light pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Next instalment (optional) — {inrCompact(outstanding)} still due
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    label="Due date"
                    type="date"
                    value={form.nextInstallmentDate || ""}
                    onChange={set("nextInstallmentDate")}
                  />
                  <Input
                    label="Expected amount (₹)"
                    type="number"
                    min="0"
                    value={form.nextInstallmentAmount || ""}
                    onChange={set("nextInstallmentAmount")}
                  />
                </div>
                <div className="mt-2">
                  <Input
                    label="Remark"
                    value={form.nextInstallmentNote || ""}
                    onChange={set("nextInstallmentNote")}
                    placeholder="e.g. client confirmed via WhatsApp"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  A reminder goes to the lead owner on this date.
                </p>
              </div>
            )}
          </div>
        )}
        {editing && (
          <p className="text-xs text-gray-400">
            Payments are logged separately — use the history (i) button on the conversion to record an
            instalment.
          </p>
        )}

        <Textarea
          label="Notes"
          value={form.notes || ""}
          onChange={set("notes")}
          placeholder="Instalment plan, terms, anything worth recording…"
        />
      </div>
      )}
    </Modal>
  );
}
