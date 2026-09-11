import { useState } from "react";
import { useForm } from "react-hook-form";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { Input } from "../../components/ui/Field.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { ROLE_LABELS } from "../../utils/roles.js";
import { initials, inrCompact } from "../../utils/format.js";
import { updateProfile, changePassword } from "../../services/authService.js";
import { createConversionType } from "../../services/conversionTypeService.js";

function ProfileForm() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name: user.name,
      phone: user.phone || "",
      city: user.city || "",
      state: user.state || "",
    },
  });

  const onSubmit = async (values) => {
    try {
      await updateProfile(values);
      await refresh?.();
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-4">Profile</h2>
      <div className="flex items-center gap-4 mb-5">
        <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-semibold">
          {initials(user.name)}
        </div>
        <div>
          <p className="font-medium text-gray-800">{user.email}</p>
          <p className="text-sm text-gray-400">
            {ROLE_LABELS[user.role]}
            {user.username ? ` · @${user.username}` : ""}
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Full name"
            required
            error={errors.name?.message}
            {...register("name", { required: "Name is required." })}
          />
          <Input label="Phone" {...register("phone")} />
          <Input label="City" {...register("city")} />
          <Input label="State" {...register("state")} />
        </div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password changed.");
      reset();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-4">Change password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <Input
          label="Current password"
          type="password"
          required
          error={errors.currentPassword?.message}
          {...register("currentPassword", { required: "Required." })}
        />
        <Input
          label="New password"
          type="password"
          required
          error={errors.newPassword?.message}
          {...register("newPassword", {
            required: "Required.",
            minLength: { value: 6, message: "At least 6 characters." },
          })}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          error={errors.confirm?.message}
          {...register("confirm", {
            validate: (v) => v === watch("newPassword") || "Passwords don't match.",
          })}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}

// Conversion types (IFO, RBC, and anything else the team wants to track) are
// company-wide, not per-user — any role can add one here so a salesperson
// closing an unusual deal isn't blocked waiting on an admin.
function ConversionTypesCard() {
  const toast = useToast();
  const { types, loading, reload } = useConversionTypes();
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the new type a name.");
    setBusy(true);
    try {
      await createConversionType({ name: name.trim(), defaultValue: Number(defaultValue) || 0 });
      toast.success(`"${name.trim()}" added — it'll show up wherever conversion type is picked.`);
      setName("");
      setDefaultValue("");
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-1">Conversion types</h2>
      <p className="text-xs text-gray-400 mb-4">
        IFO and RBC come built in. Add another type here and it becomes available for anyone recording a
        conversion, filtering reports, and on the dashboard.
      </p>

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {types.map((t) => (
            <Badge key={t.code} color={t.color}>
              {t.label}
              {t.defaultValue ? ` · ₹${inrCompact(t.defaultValue)}` : ""}
            </Badge>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <Input
          label="New type name"
          placeholder="e.g. Franchise"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="sm:w-40">
          <Input
            label="Default deal value (₹)"
            type="number"
            min="0"
            placeholder="0"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add type"}
        </Button>
      </form>
    </Card>
  );
}

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and account security." />
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <ProfileForm />
        <PasswordForm />
        <div className="xl:col-span-2">
          <ConversionTypesCard />
        </div>
      </div>
    </div>
  );
}
