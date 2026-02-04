/**
 * Navbar Component
 * Top navigation bar with user info and logout
 */

import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { NotificationBell } from '../NotificationBell';
import { getUserTimezone } from '../../utils/timezone';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-glow px-4 py-3 flex items-center justify-between">
      {/* Left side - Menu button */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Center - Title */}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        JADE GLOBAL AUTOMATION HUB
      </h1>

      {/* Right side - Notifications and User info */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <NotificationBell />
        
        {/* Profile Dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{user.role}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-600 dark:text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-glow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-500 text-white capitalize">
                      {user.role}
                    </span>
                  </p>
                </div>

                {/* Account Details */}
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">User ID:</span>
                      <span className="text-gray-900 dark:text-white font-medium">{user.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`font-medium ${user.is_active ? 'text-success-600' : 'text-error-600'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Last Login:</span>
                      <span className="text-gray-900 dark:text-white text-xs">
                        {user.last_login ? new Intl.DateTimeFormat('en-US', {
                          timeZone: getUserTimezone(),
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }).format(new Date(user.last_login)) : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 px-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
