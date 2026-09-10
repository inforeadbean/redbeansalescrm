import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import AskAssistant from "../components/AskAssistant.jsx";
import { NotificationProvider } from "../context/NotificationContext.jsx";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex h-dvh bg-surface overflow-hidden">
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <AskAssistant />
    </NotificationProvider>
  );
}
