/**
 * Navbar Component
 * Top navigation bar with user info and logout
 */

import React from 'react';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left side - Menu button */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Center - Title */}
      <h1 className="text-xl font-semibold text-gray-800">
        Infrastructure Automation Platform
      </h1>

      {/* Right side - User info and logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-gray-600" />
            <div className="text-sm">
              <p className="font-medium text-gray-700">{user.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </nav>
  );
};
