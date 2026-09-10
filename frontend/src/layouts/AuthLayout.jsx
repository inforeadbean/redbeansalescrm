import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface px-4">
      <Outlet />
    </div>
  );
}
