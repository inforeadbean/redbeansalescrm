import { useMemo, useState } from "react";
import { MdAdd, MdPersonOff, MdPersonAdd, MdEdit, MdDelete, MdSearch, MdKey, MdContentCopy } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import DataTable from "../../components/DataTable.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { useList } from "../../hooks/useList.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES, ROLE_LABELS } from "../../utils/roles.js";
import { fmtDate, initials } from "../../utils/format.js";
import { listUsers, setUserStatus, deleteUser } from "../../services/userService.js";
import UserFormModal from "./UserFormModal.jsx";
import ResetPasswordModal from "./ResetPasswordModal.jsx";

const ROLE_PILL = {
  admin: "bg-primary-light text-primary-dark",
  manager: "bg-indigo-100 text-indigo-700",
  salesperson: "bg-slate-100 text-slate-600",
};

export default function SalesTeamList() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, total, page, pages, params, setParams, reload } = useList(listUsers, {
    page: 1,
    limit: 20,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [resetFor, setResetFor] = useState(null);

  const canManageMember = (u) =>
    me.role === ROLES.ADMIN || (me.role === ROLES.MANAGER && u.role === ROLES.SALESPERSON);

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied.");
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const managers = useMemo(() => data.filter((u) => u.role === ROLES.MANAGER), [data]);

  const toggleStatus = async (u) => {
    try {
      await setUserStatus(u._id, u.status === "active" ? "inactive" : "active");
      toast.success(`${u.name} ${u.status === "active" ? "deactivated" : "activated"}.`);
      reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Member",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(u.name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{u.name}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyEmail(u.email);
              }}
              className="group flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 max-w-full"
              title="Copy email"
            >
              <span className="truncate">{u.email}</span>
              <MdContentCopy size={11} className="shrink-0 opacity-0 group-hover:opacity-100" />
            </button>
            {u.username && <p className="text-[11px] text-gray-400 truncate">@{u.username}</p>}
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (u) => <Badge color={ROLE_PILL[u.role]}>{ROLE_LABELS[u.role]}</Badge> },
    { key: "manager", header: "Reports to", render: (u) => u.manager?.name || "—" },
    { key: "phone", header: "Phone", render: (u) => u.phone || "—" },
    { key: "city", header: "City", render: (u) => u.city || "—" },
    { key: "joiningDate", header: "Joined", render: (u) => fmtDate(u.joiningDate) },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <Badge color={u.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
          {u.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setEditing(u);
              setFormOpen(true);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit"
          >
            <MdEdit size={16} />
          </button>
          {u._id !== me.id && canManageMember(u) && (
            <button
              onClick={() => setResetFor(u)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Reset password"
            >
              <MdKey size={16} />
            </button>
          )}
          {u._id !== me.id && (
            <button
              onClick={() => toggleStatus(u)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={u.status === "active" ? "Deactivate" : "Activate"}
            >
              {u.status === "active" ? <MdPersonOff size={16} /> : <MdPersonAdd size={16} />}
            </button>
          )}
          {me.role === ROLES.ADMIN && u._id !== me.id && (
            <button
              onClick={() => setToDelete(u)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <MdDelete size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Team"
        subtitle="Managers and sales people who use this CRM."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <MdAdd size={18} /> Add member
          </Button>
        }
      />

      <Card padding="p-0">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[180px]">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search name, email, phone…"
              defaultValue={params.q || ""}
              onChange={(e) => setParams({ q: e.target.value || undefined })}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Listbox
            className="w-36"
            value={params.role || ""}
            onChange={(v) => setParams({ role: v || undefined })}
            options={[
              { value: "", label: "All roles" },
              { value: "salesperson", label: "Sales Person" },
              { value: "manager", label: "Manager" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <Listbox
            className="w-32"
            value={params.status || ""}
            onChange={(v) => setParams({ status: v || undefined })}
            options={[
              { value: "", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>

        <div className="px-2">
          <DataTable
            columns={columns}
            rows={data}
            loading={loading}
            empty={
              <EmptyState
                title="No team members match"
                message="Adjust the filters, or add your first team member."
              />
            }
          />
        </div>
        <div className="px-4">
          <Pagination page={page} pages={pages} total={total} onChange={(p) => setParams({ page: p })} />
        </div>
      </Card>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        user={editing}
        managers={managers}
      />

      <ResetPasswordModal open={!!resetFor} onClose={() => setResetFor(null)} member={resetFor} />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await deleteUser(toDelete._id);
            toast.success("Member deleted.");
            reload();
          } catch (err) {
            toast.error(err);
          }
        }}
        title={`Delete ${toDelete?.name}?`}
        message="This permanently removes the account. If they own leads, reassign those first."
        confirmLabel="Delete"
      />
    </div>
  );
}
