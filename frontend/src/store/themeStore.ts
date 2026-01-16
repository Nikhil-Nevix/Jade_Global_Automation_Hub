/**
 * Theme Store - Zustand
 * Manages application theme (light/dark mode) and preferences
 */

import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  autoRefresh: boolean;
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAutoRefresh: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // Load theme from localStorage or default to light
  theme: (localStorage.getItem('theme') as Theme) || 'light',
  autoRefresh: localStorage.getItem('autoRefresh') === 'true',

  setTheme: (theme: Theme) => {
    localStorage.setItem('theme', theme);
    
    // Apply theme to document root
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    set({ theme });
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(newTheme);
  },

  setAutoRefresh: (enabled: boolean) => {
    localStorage.setItem('autoRefresh', enabled.toString());
    set({ autoRefresh: enabled });
  },
}));

// Apply initial theme on load
const initialTheme = (localStorage.getItem('theme') as Theme) || 'light';
if (initialTheme === 'dark') {
  document.documentElement.classList.add('dark');
}
