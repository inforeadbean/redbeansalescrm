import { MdInbox } from "react-icons/md";

export default function EmptyState({ icon: Icon = MdInbox, title = "Nothing here yet", message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        <Icon size={24} />
      </div>
      <p className="font-medium text-gray-700">{title}</p>
      {message && <p className="text-sm text-gray-400 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
