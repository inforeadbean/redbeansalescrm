import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { createUser, updateUser } from "../../services/userService.js";

// Create or edit a team member. `user` null => create. Managers only ever see
// the salesperson role and can't reassign the reporting manager.
export default function UserFormModal({ open, onClose, onSaved, user, managers = [] }) {
  const { user: me, refresh } = useAuth();
  const toast = useToast();
  const editing = !!user;
  const isAdmin = me.role === ROLES.ADMIN;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      name: user?.name || "",
      email: user?.email || "",
      username: user?.username || "",
      phone: user?.phone || "",
      city: user?.city || "",
      state: user?.state || "",
      role: user?.role || ROLES.SALESPERSON,
      manager: user?.manager?._id || user?.manager || "",
      password: "",
    });
  }, [open, user, reset]);

  const role = watch("role");

  const onSubmit = async (values) => {
    const payload = { ...values };
    if (editing && !payload.password) delete payload.password;
    // Only an admin can change the login email / username; never send otherwise.
    if (editing && !isAdmin) {
      delete payload.email;
      delete payload.username;
    }
    if (payload.role !== ROLES.SALESPERSON) payload.manager = "";
    try {
      const saved = editing ? await updateUser(user._id, payload) : await createUser(payload);
      toast.success(editing ? "Member updated." : "Member added.");
      // Edited your own account? pull the fresh profile into the session.
      if (editing && String(user._id) === String(me.id)) await refresh?.();
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
      title={editing ? `Edit ${user.name}` : "Add team member"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Full name"
            required
            error={errors.name?.message}
            {...register("name", { required: "Name is required." })}
          />
          <Input
            label={editing ? "Login email" : "Email"}
            type="email"
            required
            disabled={editing && !isAdmin}
            hint={editing && !isAdmin ? "Only an admin can change this." : undefined}
            error={errors.email?.message}
            {...register("email", {
              required: "Email is required.",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email." },
            })}
          />
          <Input
            label="Username (optional)"
            disabled={editing && !isAdmin}
            hint={
              editing && !isAdmin
                ? "Only an admin can change this."
                : "They can sign in with this OR their email. 3-60 chars, no spaces."
            }
            error={errors.username?.message}
            {...register("username", {
              setValueAs: (v) => (v || "").toLowerCase().trim(),
              validate: (v) =>
                !v || /^[a-z0-9][a-z0-9._-]{2,59}$/.test(v) || "Letters/numbers/._- only, min 3.",
            })}
          />
          <Input label="Phone" {...register("phone")} />
          <Input
            label={editing ? "New password" : "Temporary password"}
            type="password"
            required={!editing}
            hint={editing ? "Leave blank to keep current." : "Min 6 characters."}
            error={errors.password?.message}
            {...register("password", {
              required: editing ? false : "Password is required.",
              minLength: { value: 6, message: "At least 6 characters." },
            })}
          />
          <Input label="City" {...register("city")} />
          <Input label="State" {...register("state")} />

          {isAdmin && (
            <Select
              label="Role"
              options={[
                { value: ROLES.SALESPERSON, label: "Sales Person" },
                { value: ROLES.MANAGER, label: "Sales Manager" },
                { value: ROLES.ADMIN, label: "Admin (MD)" },
              ]}
              {...register("role")}
            />
          )}

          {isAdmin && role === ROLES.SALESPERSON && (
            <Select
              label="Reports to"
              placeholder="— No manager —"
              options={managers.map((m) => ({ value: m._id, label: m.name }))}
              {...register("manager")}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
