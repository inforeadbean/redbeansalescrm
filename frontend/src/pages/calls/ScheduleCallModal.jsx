import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Field.jsx";
import LeadPicker from "../../components/LeadPicker.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { createCall } from "../../services/callService.js";

// `fixedLead` pre-selects and locks the lead (used from the lead detail page).
export default function ScheduleCallModal({ open, onClose, onDone, fixedLead }) {
  const toast = useToast();
  const [lead, setLead] = useState(fixedLead || null);
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-init only when the modal opens (or the fixed lead changes) — not on every
  // parent re-render. The lead detail page polls in the background and re-creates
  // the `fixedLead` object each time, which would otherwise clear the form.
  useEffect(() => {
    if (open) {
      setLead(fixedLead || null);
      setWhen("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedLead?._id]);

  const submit = async () => {
    if (!lead) return toast.error("Pick a lead.");
    setBusy(true);
    try {
      await createCall({ lead: lead._id, scheduledAt: when || undefined, notes: notes.trim() || undefined });
      toast.success("Call scheduled.");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule a call"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedLead && (
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Lead</span>
            <LeadPicker value={lead} onChange={setLead} />
          </div>
        )}
        <Input label="When" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
