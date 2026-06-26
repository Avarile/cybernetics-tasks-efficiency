import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth-context';
import { AppShell } from './components/AppShell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { OkrTree } from './pages/OkrTree';
import { MyWork } from './pages/MyWork';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'okr', element: <OkrTree /> },
      { path: 'my-work', element: <MyWork /> },
    ],
  },
]);
