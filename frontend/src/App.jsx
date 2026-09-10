import { Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ROLES } from "./utils/roles.js";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NotFound from "./pages/NotFound.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import SalesTeamList from "./pages/salesTeam/SalesTeamList.jsx";
import Settings from "./pages/settings/Settings.jsx";
import LeadsBoard from "./pages/leads/LeadsBoard.jsx";
import LeadDetail from "./pages/leads/LeadDetail.jsx";
import CallsList from "./pages/calls/CallsList.jsx";
import WebinarsList from "./pages/webinars/WebinarsList.jsx";
import WebinarDetail from "./pages/webinars/WebinarDetail.jsx";
import EventsList from "./pages/events/EventsList.jsx";
import EventDetail from "./pages/events/EventDetail.jsx";
import IfoList from "./pages/ifo/IfoList.jsx";
import TargetsList from "./pages/targets/TargetsList.jsx";
import PerformanceReport from "./pages/reports/PerformanceReport.jsx";
import CallingReport from "./pages/reports/CallingReport.jsx";
import FunnelReport from "./pages/reports/FunnelReport.jsx";
import Receivables from "./pages/reports/Receivables.jsx";
import PaymentDelays from "./pages/reports/PaymentDelays.jsx";
import Leaderboard from "./pages/leaderboard/Leaderboard.jsx";

const MANAGERS = [ROLES.ADMIN, ROLES.MANAGER];

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<LeadsBoard />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/calls" element={<CallsList />} />
          <Route path="/webinars" element={<WebinarsList />} />
          <Route path="/webinars/:id" element={<WebinarDetail />} />
          <Route path="/events" element={<EventsList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/ifo" element={<IfoList />} />
          <Route path="/settings" element={<Settings />} />

          <Route element={<ProtectedRoute allowedRoles={MANAGERS} />}>
            <Route path="/sales-team" element={<SalesTeamList />} />
            <Route path="/targets" element={<TargetsList />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/reports/calling" element={<CallingReport />} />
            <Route path="/report" element={<PerformanceReport />} />
            <Route path="/reports/funnel" element={<FunnelReport />} />
            <Route path="/reports/receivables" element={<Receivables />} />
            <Route path="/reports/payment-delays" element={<PaymentDelays />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
