import { useAuth } from '../lib/auth-context';

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
      <p className="text-gray-500">
        Welcome back, <span className="font-medium text-gray-700">{user?.email}</span>
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">OKR Tree</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">—</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">My Work</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">—</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Status</p>
          <p className="text-2xl font-bold text-green-600 mt-1">Live</p>
        </div>
      </div>
    </div>
  );
}
