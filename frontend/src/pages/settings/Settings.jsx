import { useForm } from "react-hook-form";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Field.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { ROLE_LABELS } from "../../utils/roles.js";
import { initials } from "../../utils/format.js";
import { updateProfile, changePassword } from "../../services/authService.js";

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

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and account security." />
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
