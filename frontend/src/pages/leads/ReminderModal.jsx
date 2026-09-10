import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Textarea } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { ensureNotificationPermission } from "../../utils/notify.js";
import { createReminder } from "../../services/reminderService.js";

// Local-time value string for <input type="datetime-local"> — tomorrow 10:00.
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function ReminderModal({ open, onClose, onSaved, lead, defaultNote = "" }) {
  const toast = useToast();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setWhen(defaultWhen());
      setNote(defaultNote);
    }
  }, [open, defaultNote]);

  const submit = async () => {
    if (!when) return toast.error("Pick a date & time.");
    if (!note.trim()) return toast.error("Add a note for the reminder.");
    setBusy(true);
    try {
      ensureNotificationPermission(); // asked here so it's tied to a user click
      await createReminder({ lead: lead._id, remindAt: when, note: note.trim() });
      toast.success("Reminder set.");
      onSaved?.();
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
      title="Set a reminder"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Set reminder"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Remind on"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
        />
        <Textarea
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Call back about the pricing quote"
          required
        />
        <p className="text-xs text-gray-400">
          At that time {lead?.assignedTo?.name ? `${lead.assignedTo.name}` : "the lead's owner"} gets a
          bell notification here, plus a desktop pop-up if the CRM is open.
        </p>
      </div>
    </Modal>
  );
}
