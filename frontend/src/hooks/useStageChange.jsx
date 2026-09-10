import { useState } from "react";
import StatusChangeModal from "../pages/leads/StatusChangeModal.jsx";
import IfoFormModal from "../pages/ifo/IfoFormModal.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { moveBlocked } from "../utils/constants.js";

// Drives the "change a lead's stage" flow from anywhere — a table row, a list,
// a card. `trigger(lead, toStatus)` opens the right modal: the
// record-conversion form for → Converted, otherwise the remark / next-follow-up
// / session-picker modal (the same one the Kanban drag uses, so every rule
// comes along — backward-move confirm, leaving-Converted warning, webinar/event
// registration). `onChanged` runs after a successful save so the caller can
// refresh its list. Drop `modals` into the caller's JSX once.
export default function useStageChange(onChanged) {
  const toast = useToast();
  const [statusChange, setStatusChange] = useState(null); // { lead, toStatus }
  const [convertLead, setConvertLead] = useState(null);

  const trigger = (lead, toStatus) => {
    if (!lead || !toStatus || toStatus === lead.status) return;
    const blocked = moveBlocked(lead.status, toStatus);
    if (blocked) return toast.error(blocked);
    if (toStatus === "converted") setConvertLead(lead);
    else setStatusChange({ lead, toStatus });
  };

  const modals = (
    <>
      <StatusChangeModal
        open={!!statusChange}
        lead={statusChange?.lead}
        toStatus={statusChange?.toStatus}
        onClose={() => setStatusChange(null)}
        onDone={() => {
          setStatusChange(null);
          onChanged?.();
        }}
      />
      <IfoFormModal
        open={!!convertLead}
        presetLead={convertLead}
        onClose={() => setConvertLead(null)}
        onSaved={() => {
          setConvertLead(null);
          onChanged?.();
        }}
      />
    </>
  );

  return { trigger, modals };
}
