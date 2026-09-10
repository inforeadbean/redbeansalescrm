import { MdMenu } from "react-icons/md";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../utils/roles.js";
import NotificationBell from "./NotificationBell.jsx";

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
      <button className="xl:hidden text-gray-500" onClick={onMenuClick} aria-label="Open menu">
        <MdMenu size={24} />
      </button>
      <div className="hidden xl:block" />
      <div className="flex items-center gap-3.5">
        <NotificationBell />
        <div className="hidden sm:block h-8 w-px bg-gray-200" />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</p>
          <p className="text-xs text-gray-400 leading-tight">{ROLE_LABELS[user?.role]}</p>
        </div>
        <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold shrink-0 ring-2 ring-white shadow-sm shadow-primary/30">
          {user?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
