import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-bold text-primary mb-2">404</h1>
      <p className="text-gray-500 mb-6">This page doesn't exist.</p>
      <Link to="/dashboard" className="text-primary font-medium hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
