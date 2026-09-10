import { useAuth } from "../context/AuthContext.jsx";
import { ROLES } from "../utils/roles.js";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import ManagerDashboard from "./manager/ManagerDashboard.jsx";
import SalesDashboard from "./sales/SalesDashboard.jsx";

// One route ("/dashboard") for every role — which view renders is decided
// by req.user.role, not by the URL, so there's a single bookmarkable
// dashboard link no matter who's logged in.
export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === ROLES.ADMIN) return <AdminDashboard />;
  if (user.role === ROLES.MANAGER) return <ManagerDashboard />;
  return <SalesDashboard />;
}
