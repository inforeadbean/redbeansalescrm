import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Textarea, Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { WEBINAR_STATUS, optionsFrom } from "../../utils/constants.js";
import { createWebinar, updateWebinar } from "../../services/webinarService.js";

const toLocal = (d) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export default function WebinarFormModal({ open, onClose, onSaved, webinar }) {
  const toast = useToast();
  const editing = !!webinar;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      title: webinar?.title || "",
      description: webinar?.description || "",
      scheduledAt: toLocal(webinar?.scheduledAt),
      status: webinar?.status || "upcoming",
    });
  }, [open, webinar, reset]);

  const onSubmit = async (values) => {
    try {
      const saved = editing
        ? await updateWebinar(webinar._id, values)
        : await createWebinar(values);
      toast.success(editing ? "Zoom meeting updated." : "Zoom meeting created.");
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
      title={editing ? "Edit Zoom meeting" : "New Zoom meeting"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="webinar-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form id="webinar-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Title"
          required
          error={errors.title?.message}
          {...register("title", { required: "Title is required." })}
        />
        <Textarea label="Description" {...register("description")} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Date & time"
            type="datetime-local"
            required
            error={errors.scheduledAt?.message}
            {...register("scheduledAt", { required: "Required." })}
          />
          {editing && (
            <Select label="Status" options={optionsFrom(WEBINAR_STATUS)} {...register("status")} />
          )}
        </div>
      </form>
    </Modal>
  );
}
