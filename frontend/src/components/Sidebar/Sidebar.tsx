/**
 * Sidebar Component
 * Side navigation with role-based menu items
 */

import React, { useState } from 'react';
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
  Download,
  ShieldAlert,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { AIAnalyticsComingSoon } from '../AIAnalyticsComingSoon';
import infraLogo from '../../assets/Infra Automation Hub.png';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
  hidden?: boolean;     // kept in the list but never rendered (feature parked for a future role rollout)
  comingSoon?: boolean; // renders as a button that opens the "coming soon" modal instead of navigating
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Client Dashboard',
    path: '/client-dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Vulnerability Dashboard',
    path: '/vulnerability-dashboard',
    icon: ShieldAlert,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'Data Visuals',
    path: '/data-visuals',
    icon: BarChart3,
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    name: 'AI Analytics',
    path: '/ai-analytics',
    icon: Sparkles,
    roles: ['super_admin', 'admin', 'user'],
    comingSoon: true,
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
    // Temporarily hidden while the app runs with a single role; re-enable
    // (hidden: false) when a second role needs audit-log access again.
    name: 'Playbook Audit Logs',
    path: '/playbook-audit',
    icon: History,
    roles: ['super_admin', 'admin'],
    hidden: true,
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

const getUserDomain = (email: string) => email.split('@')[1]?.toLowerCase() || '';

// Pages that belong to the vulnerability (client-domain) experience.
const VULN_PATHS = ['/vulnerability-dashboard', '/data-visuals'];
const CLIENT_DASH = '/client-dashboard';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    if (item.hidden) return false;
    if (!user || !item.roles.includes(user.role)) return false;

    if (user.role !== 'super_admin') {
      const domain = getUserDomain(user.email);
      const isJade = domain === 'jadeglobal.com';
      const isIntuitive = domain.includes('intuitivesurgical');
      // Each domain sees its own home dashboard.
      if (isJade && (VULN_PATHS.includes(item.path) || item.path === CLIENT_DASH)) return false;
      if (!isJade && item.path === '/') return false;
      // Client Dashboard is only for the Intuitive Surgical domain.
      if (item.path === CLIENT_DASH && !isIntuitive) return false;
      // Intuitive users use the Client Dashboard instead of the generic Vulnerability Dashboard.
      if (isIntuitive && item.path === '/vulnerability-dashboard') return false;
    }

    return true;
  });

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
        {/* Logo banner */}
        <div className="relative border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center px-4 py-2">
          <img src={infraLogo} alt="Infra Automation Hub" className="h-10 w-auto object-contain mix-blend-multiply" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-2 right-2 p-1 rounded bg-white/70 dark:bg-gray-800/70 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              if (item.comingSoon) {
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => setAiModalOpen(true)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:shadow-glow-sm"
                    >
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </button>
                  </li>
                );
              }
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

      {/* AI Analytics — coming soon */}
      {aiModalOpen && <AIAnalyticsComingSoon onClose={() => setAiModalOpen(false)} />}
    </>
  );
};
