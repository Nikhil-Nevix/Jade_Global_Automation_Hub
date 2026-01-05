/**
 * Main App Component
 * Sets up routing and layout
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ServersPage } from './pages/ServersPage/ServersPage';
import { PlaybooksPage } from './pages/PlaybooksPage/PlaybooksPage';
import { JobDetailsPage } from './pages/JobDetailsPage/JobDetailsPage';

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    // Load user data on app start if authenticated
    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <BrowserRouter>
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
          path="/jobs"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
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

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
