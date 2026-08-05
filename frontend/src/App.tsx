/**
 * Main App Component
 * Sets up routing and layout
 */

import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { Notifications } from './components/Notifications';
import { InteractivePatchesDialog } from './components/InteractivePatchesDialog';
import { socketService } from './services/socket.service';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ClientDashboard } from './pages/ClientDashboard';
import { VulnerabilityDashboard } from './pages/VulnerabilityDashboard/VulnerabilityDashboard';
import { DataVisuals } from './pages/DataVisuals/DataVisuals';
import { ServersPage } from './pages/ServersPage/ServersPage';
import { PlaybooksPage } from './pages/PlaybooksPage/PlaybooksPage';
import { PlaybookAuditPage } from './pages/PlaybookAuditPage/PlaybookAuditPage';
import { PlaybookAuditLogsPage } from './pages/PlaybookAuditLogsPage/PlaybookAuditLogsPage';
import { JobsPage } from './pages/JobsPage/JobsPage';
import { JobDetailsPage } from './pages/JobDetailsPage/JobDetailsPage';
import { UsersPage } from './pages/UsersPage/UsersPage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotificationPreferencesPage } from './pages/NotificationPreferencesPage';
import { getBackendBaseUrl, getSocketPath } from './config/network';

// Global error boundary — prevents one crashing component from wiping the whole UI
interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error?: Error }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <pre className="mt-4 text-left text-xs text-gray-500 overflow-auto max-h-40 p-2 bg-gray-100 rounded">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Domain-based dashboard guard — routes each user to their home dashboard:
//   jadeglobal.com          → "/"                       (main Dashboard)
//   intuitivesurgical*      → "/client-dashboard"       (executive compliance)
//   other client domains    → "/vulnerability-dashboard"
// super_admin can view any dashboard (bypass).
type DashboardPage = 'dashboard' | 'vulnerability-dashboard' | 'client-dashboard';

const landingPathFor = (email: string): string => {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (domain === 'jadeglobal.com') return '/';
  if (domain.includes('intuitivesurgical')) return '/client-dashboard';
  return '/vulnerability-dashboard';
};

const PAGE_PATH: Record<DashboardPage, string> = {
  'dashboard': '/',
  'vulnerability-dashboard': '/vulnerability-dashboard',
  'client-dashboard': '/client-dashboard',
};

const DashboardGuard: React.FC<{ page: DashboardPage; children: React.ReactNode }> = ({ page, children }) => {
  const { user } = useAuthStore();
  if (!user || user.role === 'super_admin') return <>{children}</>;

  const home = landingPathFor(user.email);
  if (PAGE_PATH[page] !== home) return <Navigate to={home} replace />;

  return <>{children}</>;
};

// Main layout with sidebar and navbar
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">{children}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const { isAuthenticated, loadUser, user } = useAuthStore();
  const [patchesDialog, setPatchesDialog] = useState<{
    jobId: string;
    filePath: string;
  } | null>(null);

  useEffect(() => {
    // Load user data on app start if authenticated and user not already loaded
    if (isAuthenticated && !user) {
      console.log('[App] Loading user data...');
      loadUser().catch(err => {
        console.error('[App] Failed to load user:', err);
      });
    }
  }, [isAuthenticated, loadUser, user]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[App] Initializing WebSocket connection...');
      
      // Listen for patches_ready event before connecting
      const handlePatchesReady = (data: { job_id: string; file_path: string }) => {
        console.log('[App] Patches ready event received:', data);
        setPatchesDialog({
          jobId: data.job_id,
          filePath: data.file_path,
        });
      };

      socketService.on('patches_ready', handlePatchesReady);
      
      // Connect to WebSocket (strip /api suffix as WebSocket connects to root)
      try {
        const wsUrl = getBackendBaseUrl();
        const wsPath = getSocketPath();
        console.log('[App] WebSocket URL:', wsUrl, 'path:', wsPath);
        socketService.connect(wsUrl, wsPath);
      } catch (error) {
        console.error('[App] WebSocket connection error:', error);
      }

      return () => {
        socketService.off('patches_ready', handlePatchesReady);
        socketService.disconnect();
      };
    }
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
    <BrowserRouter basename="/">
      <Notifications />
      
      {/* Interactive Patches Dialog */}
      {patchesDialog && (
        <InteractivePatchesDialog
          jobId={patchesDialog.jobId}
          filePath={patchesDialog.filePath}
          onClose={() => setPatchesDialog(null)}
        />
      )}

      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardGuard page="dashboard">
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </DashboardGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vulnerability-dashboard"
          element={
            <ProtectedRoute>
              <DashboardGuard page="vulnerability-dashboard">
                <MainLayout>
                  <VulnerabilityDashboard />
                </MainLayout>
              </DashboardGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-dashboard"
          element={
            <ProtectedRoute>
              <DashboardGuard page="client-dashboard">
                <MainLayout>
                  <ClientDashboard />
                </MainLayout>
              </DashboardGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/data-visuals"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DataVisuals />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ServersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playbooks"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PlaybooksPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playbooks/:id/audit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PlaybookAuditPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playbook-audit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PlaybookAuditLogsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <MainLayout>
                <JobsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <JobDetailsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UsersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NotificationsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications/preferences"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NotificationPreferencesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SettingsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
};
