import { NavLink } from "react-router-dom";
import {
  MdDashboard,
  MdOutlinePeopleAlt,
  MdOutlineLeaderboard,
  MdOutlineTrackChanges,
  MdOutlineSettings,
  MdLogout,
  MdOutlineAssignment,
  MdOutlineVideocam,
  MdOutlineEvent,
  MdOutlineMonetizationOn,
  MdOutlinePhoneInTalk,
  MdOutlineInsertChartOutlined,
  MdOutlinePhoneForwarded,
  MdOutlineFilterAlt,
  MdOutlinePayments,
  MdOutlineRunningWithErrors,
  MdClose,
} from "react-icons/md";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLES } from "../utils/roles.js";
import Logo from "./Logo.jsx";

const MGR = [ROLES.ADMIN, ROLES.MANAGER];

// The nav is grouped into colour-coded sections. `accent` tints the section
// header + its idle icons; the active item always gets the brand-red pill.
// `roles` on a section or item limits visibility (undefined = everyone).
const SECTIONS = [
  {
    accent: { text: "text-primary", head: "text-primary/70" },
    items: [{ to: "/dashboard", label: "Dashboard", icon: MdDashboard }],
  },
  {
    title: "Pipeline",
    accent: { text: "text-blue-500", head: "text-blue-500/80" },
    items: [
      { to: "/leads", label: "Leads", icon: MdOutlineAssignment },
      { to: "/calls", label: "Calls", icon: MdOutlinePhoneInTalk },
      { to: "/webinars", label: "Zoom Meetings", icon: MdOutlineVideocam },
      { to: "/events", label: "Events", icon: MdOutlineEvent },
      { to: "/ifo", label: "Conversions", icon: MdOutlineMonetizationOn },
    ],
  },
  {
    title: "Reports",
    accent: { text: "text-violet-500", head: "text-violet-500/80" },
    items: [
      { to: "/reports/calling", label: "Calling Sales Report", icon: MdOutlinePhoneForwarded, roles: MGR },
      { to: "/report", label: "Sales Report", icon: MdOutlineInsertChartOutlined, roles: MGR },
      { to: "/reports/funnel", label: "Funnel", icon: MdOutlineFilterAlt, roles: MGR },
      { to: "/reports/receivables", label: "Receivables", icon: MdOutlinePayments, roles: MGR },
      { to: "/reports/payment-delays", label: "Payment Delays", icon: MdOutlineRunningWithErrors, roles: MGR },
      { to: "/leaderboard", label: "Leaderboard", icon: MdOutlineLeaderboard, roles: MGR },
    ],
  },
  {
    title: "Manage",
    accent: { text: "text-amber-600", head: "text-amber-600/80" },
    roles: MGR,
    items: [
      { to: "/targets", label: "Targets", icon: MdOutlineTrackChanges },
      { to: "/sales-team", label: "Sales Team", icon: MdOutlinePeopleAlt },
    ],
  },
  {
    accent: { text: "text-gray-400", head: "text-gray-400" },
    items: [{ to: "/settings", label: "Settings", icon: MdOutlineSettings }],
  },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => {
      const allowed = i.roles || s.roles;
      return !allowed || allowed.includes(user?.role);
    }),
  })).filter((s) => s.items.length);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 xl:hidden" onClick={onClose} />}

      <aside
        className={`fixed xl:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"} xl:translate-x-0`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={40} />
            <div className="leading-none min-w-0">
              <p className="font-bold text-gray-800 text-[15px] truncate">
                Red Bean <span className="text-primary">Hospitality</span>
              </p>
              <p className="text-[10px] text-gray-400 tracking-[0.18em] uppercase mt-1">Sales CRM</p>
            </div>
          </div>
          <button className="xl:hidden text-gray-400 shrink-0" onClick={onClose} aria-label="Close menu">
            <MdClose size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {visibleSections.map((section, si) => (
            <div key={si} className={si > 0 ? "mt-5" : ""}>
              {section.title && (
                <p
                  className={`px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${section.accent.head}`}
                >
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    end={to === "/dashboard"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-light text-primary-dark"
                          : "text-gray-600 hover:bg-gray-100"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={19} className={isActive ? "text-primary" : section.accent.text} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <MdLogout size={20} />
            Logout
          </button>
        </div>

        <div className="px-4 pb-3 pt-1 shrink-0 text-[10px] leading-relaxed text-gray-300/90 select-none">
          <p>
            Created by <span className="text-gray-400/90">Krrish</span> &amp;{" "}
            <span className="text-gray-400/90">Ritesh</span>
          </p>
          <p>
            Designed by <span className="text-gray-400/90">Sahil</span>
          </p>
        </div>
      </aside>
    </>
  );
}
