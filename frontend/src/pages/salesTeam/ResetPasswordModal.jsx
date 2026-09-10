import { useEffect, useState } from "react";
import { MdContentCopy, MdCheck, MdKey } from "react-icons/md";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { resetUserPassword } from "../../services/userService.js";

// Admin/manager: set a fresh password for a team member and see it ONCE
// (it's stored hashed — nobody can read it later). Copy it, hand it over,
// they change it from Settings after logging in.
export default function ResetPasswordModal({ open, onClose, member }) {
  const toast = useToast();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { name, email, password }
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (open) {
      setCustom("");
      setResult(null);
      setCopied("");
    }
  }, [open]);

  const submit = async () => {
    if (custom && custom.trim().length < 6) return toast.error("At least 6 characters.");
    setBusy(true);
    try {
      const r = await resetUserPassword(member._id, custom.trim() || undefined);
      setResult(r);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <MdKey size={18} className="text-gray-400" /> Reset password
        </span>
      }
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Setting…" : custom.trim() ? "Set password" : "Generate & set"}
            </Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            New password for <b className="text-gray-800">{member?.name}</b> ({member?.email}).
          </p>
          <label className="block">
            <span className="text-xs text-gray-500">Set a specific password (optional)</span>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="leave blank to auto-generate"
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <p className="text-xs text-gray-400">
            You'll see the password once, right after. The old one stops working immediately.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Password set for <b>{result.name}</b>. Copy it now — it can't be shown again.
          </p>
          <Field label="Login email" value={result.email} copied={copied === "email"} onCopy={() => copy(result.email, "email")} />
          {result.username && (
            <Field label="Username" value={result.username} copied={copied === "un"} onCopy={() => copy(result.username, "un")} />
          )}
          <Field label="Password" value={result.password} mono copied={copied === "pw"} onCopy={() => copy(result.password, "pw")} />
          <button
            onClick={() =>
              copy(
                `Login: ${result.email}${result.username ? ` (or username: ${result.username})` : ""}\nPassword: ${result.password}`,
                "both"
              )
            }
            className="text-xs font-medium text-primary hover:text-primary-dark"
          >
            {copied === "both" ? "Copied ✓" : "Copy all together"}
          </button>
          <p className="text-xs text-gray-400">
            Share via WhatsApp/email. Ask {result.name.split(" ")[0]} to change it from Settings → Change password.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value, mono, copied, onCopy }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm break-all ${
            mono ? "font-mono tracking-wide text-gray-900" : "text-gray-700"
          }`}
        >
          {value}
        </code>
        <button
          onClick={onCopy}
          className="shrink-0 p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          title="Copy"
        >
          {copied ? <MdCheck size={16} className="text-green-600" /> : <MdContentCopy size={16} />}
        </button>
      </div>
    </div>
  );
}
