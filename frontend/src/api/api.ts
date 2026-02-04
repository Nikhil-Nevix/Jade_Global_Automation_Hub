/**
 * Centralized API Client using Axios
 * Handles authentication, request/response interceptors, and all API calls
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  TokenResponse,
  User,
  Server,
  ServerCreateRequest,
  ServerUpdateRequest,
  ServerFilters,
  Playbook,
  PlaybookFilters,
  Job,
  JobCreateRequest,
  JobFilters,
  JobLogsResponse,
  JobStatistics,
  BatchJobCreateRequest,
  BatchJobResponse,
  ChildJobsResponse,
  Ticket,
  TicketCreateRequest,
  PaginatedResponse,
  HealthResponse,
  Notification,
  NotificationPreference,
  NotificationListResponse,
  NotificationPreferencesResponse,
  UnreadCountResponse,
} from '../types';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - attach JWT token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          console.warn('[API] No refresh token available, redirecting to login');
          // Silently redirect without throwing error
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post<TokenResponse>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        );

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        // Refresh failed - clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ===== Authentication API =====

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  signup: async (data: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ message: string; user: User }> => {
    const response = await axiosInstance.post('/auth/signup', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },

  refreshToken: async (): Promise<TokenResponse> => {
    const response = await axiosInstance.post<TokenResponse>('/auth/refresh');
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await axiosInstance.get<User>('/auth/me');
    return response.data;
  },
};

// ===== Servers API =====

export const serversApi = {
  list: async (filters?: ServerFilters): Promise<PaginatedResponse<Server>> => {
    const response = await axiosInstance.get<PaginatedResponse<Server>>('/servers', {
      params: filters,
    });
    return response.data;
  },

  get: async (id: number): Promise<Server> => {
    const response = await axiosInstance.get<Server>(`/servers/${id}`);
    return response.data;
  },

  create: async (data: ServerCreateRequest): Promise<Server> => {
    const response = await axiosInstance.post<Server>('/servers', data);
    return response.data;
  },

  update: async (id: number, data: ServerUpdateRequest): Promise<Server> => {
    const response = await axiosInstance.put<Server>(`/servers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/servers/${id}`);
  },

  testConnection: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await axiosInstance.post(`/servers/${id}/test`);
    return response.data;
  },

  getMetrics: async (id: number): Promise<{
    server_id: number;
    hostname: string;
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    last_monitored: string | null;
  }> => {
    const response = await axiosInstance.get(`/servers/${id}/metrics`);
    return response.data;
  },

  refreshAllMetrics: async (): Promise<{ message: string; servers_updated: number }> => {
    const response = await axiosInstance.post('/servers/metrics/refresh');
    return response.data;
  },
};

// ===== Playbooks API =====

export const playbooksApi = {
  list: async (filters?: PlaybookFilters): Promise<PaginatedResponse<Playbook>> => {
    const response = await axiosInstance.get<PaginatedResponse<Playbook>>('/playbooks', {
      params: filters,
    });
    return response.data;
  },

  get: async (id: number): Promise<Playbook> => {
    const response = await axiosInstance.get<Playbook>(`/playbooks/${id}`);
    return response.data;
  },

  getContent: async (id: number): Promise<{ playbook_id: number; content: string }> => {
    const response = await axiosInstance.get<{ playbook_id: number; content: string }>(
      `/playbooks/${id}/content`
    );
    return response.data;
  },

  updateContent: async (id: number, content: string): Promise<{ message: string; playbook: Playbook }> => {
    const response = await axiosInstance.put<{ message: string; playbook: Playbook }>(
      `/playbooks/${id}/content`,
      { content }
    );
    return response.data;
  },

  upload: async (file: File, name: string, description?: string): Promise<Playbook> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }

    const response = await axiosInstance.post<Playbook>('/playbooks/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadFolder: async (file: File, name: string, mainPlaybookFile: string, description?: string): Promise<Playbook> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('main_playbook_file', mainPlaybookFile);
    if (description) {
      formData.append('description', description);
    }

    const response = await axiosInstance.post<Playbook>('/playbooks/upload-folder', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  previewZip: async (file: File): Promise<{ yaml_files: string[]; suggested_main: string; total_files: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axiosInstance.post<{ yaml_files: string[]; suggested_main: string; total_files: number }>(
      '/playbooks/preview-zip',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getFolderFiles: async (id: number): Promise<{ files: string[] }> => {
    const response = await axiosInstance.get<{ files: string[] }>(`/playbooks/${id}/files`);
    return response.data;
  },

  getFolderFileContent: async (id: number, filePath: string): Promise<{ content: string; file_path: string }> => {
    const response = await axiosInstance.get<{ content: string; file_path: string }>(
      `/playbooks/${id}/files/${filePath}`
    );
    return response.data;
  },

  updateFolderFileContent: async (id: number, filePath: string, content: string): Promise<{ message: string }> => {
    const response = await axiosInstance.put<{ message: string }>(
      `/playbooks/${id}/files/${filePath}`,
      { content }
    );
    return response.data;
  },

  downloadFolder: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(`/playbooks/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  update: async (
    id: number,
    data: { description?: string; tags?: Record<string, any>; variables?: Record<string, any> }
  ): Promise<Playbook> => {
    const response = await axiosInstance.put<Playbook>(`/playbooks/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/playbooks/${id}`);
  },

  getAuditLogs: async (id: number, page: number = 1, per_page: number = 50): Promise<{ playbook_id: number; audit_logs: any[] }> => {
    const response = await axiosInstance.get(`/playbooks/${id}/audit-logs`, {
      params: { page, per_page }
    });
    return response.data;
  },
};

// ===== Jobs API =====

export const jobsApi = {
  list: async (filters?: JobFilters): Promise<PaginatedResponse<Job>> => {
    const response = await axiosInstance.get<PaginatedResponse<Job>>('/jobs', {
      params: filters,
    });
    return response.data;
  },

  get: async (id: number): Promise<Job> => {
    const response = await axiosInstance.get<Job>(`/jobs/${id}`);
    return response.data;
  },

  create: async (data: JobCreateRequest): Promise<Job> => {
    const response = await axiosInstance.post<Job>('/jobs', data);
    return response.data;
  },

  cancel: async (id: number): Promise<Job> => {
    const response = await axiosInstance.post<Job>(`/jobs/${id}/cancel`);
    return response.data;
  },

  getLogs: async (id: number, startLine = 0, lines = 100): Promise<JobLogsResponse> => {
    const response = await axiosInstance.get<JobLogsResponse>(`/jobs/${id}/logs`, {
      params: { start_line: startLine, lines },
    });
    return response.data;
  },

  getStatistics: async (): Promise<JobStatistics> => {
    const response = await axiosInstance.get<JobStatistics>('/jobs/stats');
    return response.data;
  },

  // Analytics methods
  getSuccessRateTrends: async (params: {
    time_range?: string;
    start_date?: string;
    end_date?: string;
    granularity?: string;
  }): Promise<any> => {
    const response = await axiosInstance.get('/jobs/analytics/success-rate-trends', { params });
    return response.data;
  },

  getExecutionTimeAnalytics: async (params: {
    time_range?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<any> => {
    const response = await axiosInstance.get('/jobs/analytics/execution-time', { params });
    return response.data;
  },

  getFailureAnalysis: async (params: {
    time_range?: string;
    start_date?: string;
    end_date?: string;
    group_by?: string;
  }): Promise<any> => {
    const response = await axiosInstance.get('/jobs/analytics/failure-analysis', { params });
    return response.data;
  },

  exportAnalytics: async (params: {
    format: 'pdf' | 'csv';
    time_range?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> => {
    const response = await axiosInstance.get('/jobs/analytics/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // Batch job methods
  createBatch: async (data: BatchJobCreateRequest): Promise<BatchJobResponse> => {
    const response = await axiosInstance.post<BatchJobResponse>('/jobs/batch', data);
    return response.data;
  },

  getChildJobs: async (parentJobId: number): Promise<ChildJobsResponse> => {
    const response = await axiosInstance.get<ChildJobsResponse>(`/jobs/${parentJobId}/children`);
    return response.data;
  },
};

// ===== Tickets API =====

export const ticketsApi = {
  create: async (data: TicketCreateRequest): Promise<Ticket> => {
    const response = await axiosInstance.post<Ticket>('/tickets', data);
    return response.data;
  },

  get: async (id: number): Promise<Ticket> => {
    const response = await axiosInstance.get<Ticket>(`/tickets/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string): Promise<Ticket> => {
    const response = await axiosInstance.put<Ticket>(`/tickets/${id}`, { status });
    return response.data;
  },
};

// ===== Users API (Admin only) =====

export const usersApi = {
  list: async (params: { page?: number; per_page?: number } = {}): Promise<PaginatedResponse<User>> => {
    const response = await axiosInstance.get<PaginatedResponse<User>>('/users', {
      params: { page: params.page || 1, per_page: params.per_page || 20 },
    });
    return response.data;
  },

  create: async (data: {
    username: string;
    email: string;
    password: string;
    role: string;
  }): Promise<User> => {
    const response = await axiosInstance.post<User>('/users', data);
    return response.data;
  },

  update: async (
    id: number,
    data: { email?: string; role?: string; is_active?: boolean }
  ): Promise<User> => {
    const response = await axiosInstance.put<User>(`/users/${id}`, data);
    return response.data;
  },

  updateTimezone: async (timezone: string): Promise<User> => {
    const response = await axiosInstance.patch<User>('/users/me/timezone', { timezone });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`);
  },
};

// ===== Notifications API =====

export const notificationsApi = {
  list: async (params?: { unread_only?: boolean; limit?: number; offset?: number }): Promise<NotificationListResponse> => {
    const response = await axiosInstance.get<NotificationListResponse>('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await axiosInstance.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data.count;
  },

  markAsRead: async (id: number): Promise<void> => {
    await axiosInstance.put(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosInstance.put('/notifications/mark-all-read');
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/notifications/${id}`);
  },

  deleteAllRead: async (): Promise<void> => {
    await axiosInstance.delete('/notifications/delete-all-read');
  },

  getPreferences: async (): Promise<NotificationPreferencesResponse> => {
    const response = await axiosInstance.get<NotificationPreferencesResponse>('/notifications/preferences');
    return response.data;
  },

  updatePreference: async (
    eventType: string,
    data: { in_app_enabled?: boolean; email_enabled?: boolean; browser_push_enabled?: boolean }
  ): Promise<NotificationPreference> => {
    const response = await axiosInstance.put<{ preference: NotificationPreference }>(
      `/notifications/preferences/${eventType}`,
      data
    );
    return response.data.preference;
  },

  // SSE stream endpoint URL (not using axios)
  getStreamUrl: (): string => {
    const token = localStorage.getItem('access_token');
    return `${API_BASE_URL}/notifications/stream?token=${token}`;
  },
};

// ===== Health Check API =====

export const healthApi = {
  check: async (): Promise<HealthResponse> => {
    const response = await axiosInstance.get<HealthResponse>('/health');
    return response.data;
  },
};

// Export axios instance for custom requests
export default axiosInstance;
