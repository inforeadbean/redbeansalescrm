import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Textarea, Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { EVENT_STATUS, optionsFrom } from "../../utils/constants.js";
import { createEvent, updateEvent } from "../../services/eventService.js";

const toLocal = (d) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export default function EventFormModal({ open, onClose, onSaved, event }) {
  const toast = useToast();
  const editing = !!event;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      title: event?.title || "",
      description: event?.description || "",
      venue: event?.venue || "",
      city: event?.city || "",
      date: toLocal(event?.date),
      status: event?.status || "upcoming",
    });
  }, [open, event, reset]);

  const onSubmit = async (values) => {
    try {
      const saved = editing ? await updateEvent(event._id, values) : await createEvent(values);
      toast.success(editing ? "Event updated." : "Event created.");
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
      title={editing ? "Edit event" : "New event"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Title"
          required
          error={errors.title?.message}
          {...register("title", { required: "Title is required." })}
        />
        <Textarea label="Description" {...register("description")} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Venue" {...register("venue")} />
          <Input label="City" {...register("city")} />
          <Input
            label="Date & time"
            type="datetime-local"
            required
            error={errors.date?.message}
            {...register("date", { required: "Required." })}
          />
          {editing && (
            <Select label="Status" options={optionsFrom(EVENT_STATUS)} {...register("status")} />
          )}
        </div>
      </form>
    </Modal>
  );
}
