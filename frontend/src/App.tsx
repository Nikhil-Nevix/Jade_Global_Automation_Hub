/**
 * Main App Component
 * Sets up routing and layout
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { Notifications } from './components/Notifications';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
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
import PatchManagement from './pages/PatchManagement';

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

  useEffect(() => {
    // Load user data on app start if authenticated and user not already loaded
    if (isAuthenticated && !user) {
      console.log('[App] Loading user data...');
      loadUser().catch(err => {
        console.error('[App] Failed to load user:', err);
      });
    }
  }, [isAuthenticated, loadUser, user]);

  return (
    <BrowserRouter>
      <Notifications />
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
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
          path="/patch-management"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PatchManagement />
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
  );
};
