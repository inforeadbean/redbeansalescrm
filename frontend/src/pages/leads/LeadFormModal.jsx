import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { LEAD_SOURCE, optionsFrom } from "../../utils/constants.js";
import { fmtDate } from "../../utils/format.js";
import { createLead, updateLead } from "../../services/leadService.js";
import { getAssignable } from "../../services/userService.js";
import { listWebinars } from "../../services/webinarService.js";

export default function LeadFormModal({ open, onClose, onSaved, lead }) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!lead;
  const canAssign = user.role !== ROLES.SALESPERSON;
  const [people, setPeople] = useState([]);
  const [webinars, setWebinars] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm();
  const webinarId = watch("webinar");
  const fromWebinar = !editing && !!webinarId;

  useEffect(() => {
    if (!open) return;
    if (canAssign) getAssignable().then(setPeople).catch(() => {});
    if (!editing) listWebinars().then(setWebinars).catch(() => {});
  }, [open, canAssign, editing]);

  // New leads mostly come from the most recent webinar — preselect it once the
  // list (sorted newest-first) has rendered its <option>s. The user can clear it.
  useEffect(() => {
    if (open && !editing && webinars[0]?._id) {
      setValue("webinar", webinars[0]._id, { shouldDirty: false });
    }
  }, [open, editing, webinars, setValue]);

  // Keep Source in step with the Zoom link — picking / clearing a Zoom flips it
  // to "Zoom meeting" / "Other". It's still a normal dropdown: the salesperson
  // can then set it to Social, Referral, Cold call, etc.
  useEffect(() => {
    if (!open || editing) return;
    setValue("source", webinarId ? "webinar" : "other", { shouldDirty: false });
  }, [open, editing, webinarId, setValue]);

  // Populate the form only when the modal opens (or the target lead changes) —
  // the lead detail page polls in the background and re-creates the `lead`
  // object, and reacting to that here would discard edits in progress.
  useEffect(() => {
    if (!open) return;
    reset({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      restaurantName: lead?.restaurantName || "",
      city: lead?.city || "",
      state: lead?.state || "",
      source: lead?.source || "other",
      potentialValue: lead?.potentialValue || "",
      nextFollowUpDate: lead?.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : "",
      assignedTo: lead?.assignedTo?._id || lead?.assignedTo || "",
      webinar: (!editing && webinars[0]?._id) || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?._id]);

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      phone: (values.phone || "").replace(/\D/g, ""),
      potentialValue: Number(values.potentialValue) || 0,
      nextFollowUpDate: values.nextFollowUpDate || undefined,
      webinar: values.webinar || undefined,
    };
    if (!canAssign) delete payload.assignedTo;
    if (editing) delete payload.webinar;
    try {
      const saved = editing ? await updateLead(lead._id, payload) : await createLead(payload);
      toast.success(editing ? "Lead updated." : "Lead added.");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${lead.name}` : "New lead"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Contact name"
          required
          error={errors.name?.message}
          {...register("name", { required: "Name is required." })}
        />
        <Input
          label="Phone"
          required
          inputMode="numeric"
          maxLength={14}
          placeholder="10-digit number"
          error={errors.phone?.message}
          {...register("phone", {
            required: "Phone is required.",
            validate: (v) =>
              (v || "").replace(/\D/g, "").length === 10 || "Enter a 10-digit phone number.",
          })}
        />
        <Input label="Email" type="email" {...register("email")} />
        <Input label="Restaurant / brand" {...register("restaurantName")} />
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
        <Select
          label="Source"
          options={optionsFrom(LEAD_SOURCE)}
          hint={fromWebinar ? "From the Zoom meeting below — change if it came from elsewhere." : undefined}
          {...register("source")}
        />
        <Input
          label="Potential value (₹)"
          type="number"
          min="0"
          {...register("potentialValue")}
        />
        <Input label="Next follow-up" type="date" {...register("nextFollowUpDate")} />
        {canAssign && (
          <Select
            label="Assign to"
            placeholder="— Me —"
            options={people.map((p) => ({ value: p._id, label: p.name }))}
            {...register("assignedTo")}
          />
        )}
        {!editing && (
          <Select
            label="From Zoom meeting"
            hint="If this lead came from a Zoom meeting, pick it — they'll be registered for it."
            placeholder="— Not from a Zoom meeting —"
            className="sm:col-span-2"
            options={webinars.map((w) => ({
              value: w._id,
              label: `${w.title} · ${fmtDate(w.scheduledAt)}`,
            }))}
            {...register("webinar")}
          />
        )}
      </form>
    </Modal>
  );
}
