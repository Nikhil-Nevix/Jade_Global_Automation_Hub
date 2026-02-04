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
  History,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import logo from '../../assets/Logo1.png';

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
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Servers',
    path: '/servers',
    icon: Server,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Playbooks',
    path: '/playbooks',
    icon: FileCode,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Playbook Audit Logs',
    path: '/playbook-audit',
    icon: History,
    roles: ['super_admin', 'admin'],
  },
  {
    name: 'Jobs',
    path: '/jobs',
    icon: Clock,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'User Management',
    path: '/users',
    icon: Users,
    roles: ['super_admin', 'admin'],
  },
  {
    name: 'Notifications',
    path: '/notifications',
    icon: Bell,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    roles: ['super_admin', 'admin', 'user'],
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
        className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 z-20 lg:hidden"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-glow-lg flex flex-col">
        {/* Logo and close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg shadow-md" />
            <span className="font-semibold text-gray-900 dark:text-white">Jade Global Automation Hub</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
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
                      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-500 text-white shadow-glow-lg'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:shadow-glow-sm'
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
