import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
      <p className="text-gray-500 mb-6">Your role doesn't have permission to view this page.</p>
      <Link to="/dashboard" className="text-primary font-medium hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
