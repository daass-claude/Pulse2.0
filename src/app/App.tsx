import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { EODProvider } from './contexts/EODContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Team } from './pages/Team';
import { EodsPayroll } from './pages/EodsPayroll';
import { ArchiveFiles } from './pages/ArchiveFiles';
import { Profile } from './pages/Profile';
import { Analytics } from './pages/Analytics';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="team" element={<Team />} />
        <Route path="eods" element={<AdminRoute><EodsPayroll /></AdminRoute>} />
        <Route path="archive" element={<AdminRoute><ArchiveFiles /></AdminRoute>} />
        <Route path="analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <EODProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </EODProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
