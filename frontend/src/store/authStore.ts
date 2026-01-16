/**
 * Authentication Store - Zustand
 * Manages user authentication state, tokens, and auth operations
 */

import { create } from 'zustand';
import { authApi } from '../api/api';
import { mockApi } from '../api/mockApi';
import type { User, LoginRequest } from '../types';

// Check if running in demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const api = isDemoMode ? mockApi.auth : authApi;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  login: async (credentials: LoginRequest) => {
    console.log('[AuthStore] Starting login with:', credentials);
    set({ isLoading: true, error: null });
    try {
      console.log('[AuthStore] Calling API login...');
      const response = await api.login(credentials);
      console.log('[AuthStore] API response received:', JSON.stringify(response));
      
      if (!response) {
        throw new Error('No response from server');
      }
      
      const { access_token, refresh_token, user } = response;
      console.log('[AuthStore] Extracted tokens:', { 
        hasAccessToken: !!access_token, 
        hasRefreshToken: !!refresh_token, 
        hasUser: !!user 
      });

      if (!access_token || !refresh_token || !user) {
        throw new Error('Invalid response structure: missing required fields');
      }

      // Store tokens in localStorage
      try {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        console.log('[AuthStore] Tokens saved to localStorage');
      } catch (storageError) {
        console.error('[AuthStore] localStorage error:', storageError);
        throw new Error('Failed to save authentication tokens');
      }

      set({
        user,
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      console.log('[AuthStore] State updated successfully, isAuthenticated=true');
    } catch (error: any) {
      console.error('[AuthStore] Login error:', error);
      console.error('[AuthStore] Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Login failed. Please check your credentials.';
      set({
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
      });
      console.log('[AuthStore] Error state set:', errorMessage);
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens and state regardless of API call result
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },

  loadUser: async () => {
    const { accessToken } = get();
    if (!accessToken) {
      return;
    }

    set({ isLoading: true });
    try {
      const user = await api.getCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Load user error:', error);
      // If token is invalid, clear auth state
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user: User) => set({ user }),
}));
