import { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Select, Textarea, Input } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CALL_OUTCOME, optionsFrom } from "../../utils/constants.js";
import { completeCall } from "../../services/callService.js";

export default function CompleteCallModal({ open, onClose, call, onDone }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState("connected");
  const [notes, setNotes] = useState("");
  const [nextCallAt, setNextCallAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await completeCall(call._id, {
        outcome,
        notes: notes.trim() || undefined,
        nextCallAt: nextCallAt || undefined,
      });
      toast.success("Call logged.");
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
      title={`Log call — ${call?.lead?.name || ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          options={optionsFrom(CALL_OUTCOME)}
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was discussed…"
        />
        <Input
          label="Schedule next call (optional)"
          type="datetime-local"
          value={nextCallAt}
          onChange={(e) => setNextCallAt(e.target.value)}
          hint="Books a follow-up call and sets the lead's next follow-up date."
        />
      </div>
    </Modal>
  );
}
