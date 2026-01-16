/**
 * Sidebar Component
 * Side navigation with role-based menu items
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  FileCode,
  Clock,
  Users,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    name: 'Servers',
    path: '/servers',
    icon: Server,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    name: 'Playbooks',
    path: '/playbooks',
    icon: FileCode,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    name: 'Jobs',
    path: '/jobs',
    icon: Clock,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    name: 'User Management',
    path: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    roles: ['admin', 'operator', 'viewer'],
  },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  if (!sidebarOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 lg:hidden"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Logo and close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">IA</span>
            </div>
            <span className="font-semibold text-gray-800 dark:text-white">InfraAuto</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            v1.0.0 | © 2026 InfraAuto
          </p>
        </div>
      </aside>
    </>
  );
};
