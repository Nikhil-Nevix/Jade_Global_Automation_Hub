/**
 * UI Store - Zustand
 * Manages UI state: sidebar, notifications, loading states, modals, selected entities
 */

import { create } from 'zustand';
import type { Server, Playbook, Job } from '../types';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: string) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Selected entities
  selectedServer: Server | null;
  selectedPlaybook: Playbook | null;
  selectedJob: Job | null;
  setSelectedServer: (server: Server | null) => void;
  setSelectedPlaybook: (playbook: Playbook | null) => void;
  setSelectedJob: (job: Job | null) => void;

  // Modal states
  isServerModalOpen: boolean;
  isPlaybookModalOpen: boolean;
  isJobModalOpen: boolean;
  setServerModalOpen: (open: boolean) => void;
  setPlaybookModalOpen: (open: boolean) => void;
  setJobModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Notifications
  notifications: [],
  addNotification: (type, message, duration = 5000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, type, message, duration };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // Auto-remove notification after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // Loading state
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // Selected entities
  selectedServer: null,
  selectedPlaybook: null,
  selectedJob: null,
  setSelectedServer: (server) => set({ selectedServer: server }),
  setSelectedPlaybook: (playbook) => set({ selectedPlaybook: playbook }),
  setSelectedJob: (job) => set({ selectedJob: job }),

  // Modal states
  isServerModalOpen: false,
  isPlaybookModalOpen: false,
  isJobModalOpen: false,
  setServerModalOpen: (open) => set({ isServerModalOpen: open }),
  setPlaybookModalOpen: (open) => set({ isPlaybookModalOpen: open }),
  setJobModalOpen: (open) => set({ isJobModalOpen: open }),
}));
