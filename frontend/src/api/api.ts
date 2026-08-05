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
  ServerLocationsResponse,
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
  Tag,
  ScanRun,
  VulnerabilityFinding,
  ScanTriggerRequest,
  SupersetTokenResponse,
  SupersetCustomizeResponse,
} from '../types';
import { getApiBaseUrl } from '../config/network';

// Base API configuration
const API_BASE_URL = getApiBaseUrl();

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

  locations: async (): Promise<ServerLocationsResponse> => {
    const response = await axiosInstance.get<ServerLocationsResponse>('/servers/locations');
    return response.data;
  },

  selectionIds: async (location?: string): Promise<{ server_ids: number[]; count: number }> => {
    const response = await axiosInstance.get('/servers/ids', { params: { location } });
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
    await axiosInstance.delete(`/servers/${id}`, {
      params: { hard: 'true' }
    });
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

  // Patch report download
  downloadPatchReport: async (jobId: number): Promise<string> => {
    const response = await axiosInstance.get(`/jobs/${jobId}/patch-report`, {
      responseType: 'text',
    });
    return response.data;
  },

  // RPM CSV report
  getRpmCsv: async (jobId: number): Promise<{
    success: boolean;
    filename: string;
    headers: string[];
    data: string[][];
    total_rows: number;
  }> => {
    const response = await axiosInstance.get(`/jobs/${jobId}/rpm-csv`);
    return response.data;
  },

  // Get generated files
  getGeneratedFiles: async (jobId: number): Promise<{
    success: boolean;
    files: Array<{
      path: string;
      filename: string;
      size: number;
      size_formatted: string;
      type: 'csv' | 'text' | 'json' | 'markup' | 'excel' | 'pdf' | 'other';
      extension: string;
    }>;
    total: number;
    message?: string;
  }> => {
    const response = await axiosInstance.get(`/jobs/${jobId}/generated-files`);
    return response.data;
  },

  // Download or view generated file
  downloadGeneratedFile: async (
    jobId: number,
    filePath: string,
    action: 'download' | 'view' = 'download'
  ): Promise<any> => {
    if (action === 'download') {
      // For download, get as blob and trigger download
      const response = await axiosInstance.get(
        `/jobs/${jobId}/download-file`,
        {
          params: { file_path: filePath, action: 'download' },
          responseType: 'blob',
        }
      );
      
      // Extract filename from file path
      const filename = filePath.split('/').pop() || 'download';
      
      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, filename };
    } else {
      // For view, get structured data
      const response = await axiosInstance.get(`/jobs/${jobId}/download-file`, {
        params: { file_path: filePath, action: 'view' },
      });
      return response.data;
    }
  },

  // Get firmware compliance matrix
  getFirmwareComplianceMatrix: async (jobIds?: number[]): Promise<{
    success: boolean;
    data: Array<{
      location: string;
      vendors: {
        [vendorName: string]: {
          percentage: number;
          status: 'compliant' | 'warning' | 'critical';
        };
      };
    }>;
    vendors: string[];
  }> => {
    const params = jobIds ? { job_ids: jobIds.join(',') } : {};
    const response = await axiosInstance.get('/jobs/compliance/firmware-matrix', { params });
    return response.data;
  },

  // List stored report files and pre-parsed summary for a job
  getJobReports: async (jobId: number): Promise<{
    success: boolean;
    job_id: number;
    report_files: Array<{
      filename: string;
      path: string;
      remote_path: string | null;
      size_kb: number;
      type: 'compliance' | 'patch' | 'general';
      saved_at: string;
    }>;
    result_summary: {
      compliant: number;
      non_compliant: number;
      total: number;
      compliance_pct: number;
      risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
      status_breakdown: Record<string, number>;
      headers_by_file: Record<string, string[]>;
      row_count: number;
      parsed_at: string;
    } | Record<string, never>;
  }> => {
    const response = await axiosInstance.get(`/jobs/${jobId}/reports`);
    return response.data;
  },

  // Download a stored report file as CSV or view as parsed JSON
  downloadJobReport: async (
    jobId: number,
    filename: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<any> => {
    if (format === 'csv') {
      const response = await axiosInstance.get(`/jobs/${jobId}/reports/${filename}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true, filename };
    }
    const response = await axiosInstance.get(`/jobs/${jobId}/reports/${filename}`, {
      params: { format: 'json' },
    });
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
    await axiosInstance.put('/notifications/read-all');
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/notifications/${id}`);
  },

  deleteAllRead: async (): Promise<void> => {
    await axiosInstance.delete('/notifications/read-all');
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
// ===== Tags API =====

export const tagsApi = {
  list: async (category?: string): Promise<{ items: Tag[] }> => {
    const response = await axiosInstance.get<{ items: Tag[] }>('/tags', {
      params: category ? { category } : undefined,
    });
    return response.data;
  },

  create: async (data: { name: string; description?: string; category?: string }): Promise<Tag> => {
    const response = await axiosInstance.post<Tag>('/tags', data);
    return response.data;
  },

  update: async (id: number, data: { name?: string; description?: string; category?: string }): Promise<Tag> => {
    const response = await axiosInstance.put<Tag>(`/tags/${id}`, data);
    return response.data;
  },

  sync: async (): Promise<{ message: string }> => {
    const response = await axiosInstance.post<{ message: string }>('/tags/sync');
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/tags/${id}`);
  },

  addServers: async (tagId: number, serverIds: number[]): Promise<{ message: string }> => {
    const response = await axiosInstance.post(`/tags/${tagId}/servers`, serverIds);
    return response.data;
  },

  removeServer: async (tagId: number, serverId: number): Promise<{ message: string }> => {
    const response = await axiosInstance.delete(`/tags/${tagId}/servers/${serverId}`);
    return response.data;
  },
};

// ===== Vulnerability API =====

export const vulnerabilityApi = {
  listRuns: async (page = 1, perPage = 20): Promise<PaginatedResponse<ScanRun>> => {
    const response = await axiosInstance.get<PaginatedResponse<ScanRun>>('/vulnerability/runs', {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  getRun: async (id: number): Promise<ScanRun> => {
    const response = await axiosInstance.get<ScanRun>(`/vulnerability/runs/${id}`);
    return response.data;
  },

  downloadRunCsv: async (id: number): Promise<{ url: string }> => {
    const response = await axiosInstance.get(`/vulnerability/runs/${id}/download`);
    return response.data;
  },

  triggerScan: async (data: ScanTriggerRequest): Promise<ScanRun> => {
    const response = await axiosInstance.post<ScanRun>('/vulnerability/runs', data);
    return response.data;
  },

  listFindings: async (params?: Record<string, unknown>): Promise<PaginatedResponse<VulnerabilityFinding>> => {
    const response = await axiosInstance.get<PaginatedResponse<VulnerabilityFinding>>('/vulnerability/findings', {
      params,
    });
    return response.data;
  },

  qdsDistribution: async (runId?: number, location?: string, environment?: string): Promise<{ buckets: Array<{ range: string; start: number; count: number }> }> => {
    const response = await axiosInstance.get('/vulnerability/qds-distribution', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  trueRisk: async (runId?: number, location?: string, environment?: string): Promise<{
    buckets: Array<{ range: string; start: number; count: number }>;
    top_servers: Array<{ ip: string; dns: string | null; total_score: number; max_score: number; avg_score: number; findings: number }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/true-risk', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  stats: async (runId?: number, location?: string, environment?: string): Promise<{
    latest_run_id: number | null;
    total: number;
    by_severity: Record<string, number>;
    avg_true_risk_score: number | null;
    internet_facing_count: number;
  }> => {
    const response = await axiosInstance.get('/vulnerability/stats', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  slaCompliance: async (runId?: number, location?: string, environment?: string): Promise<{
    run_id: number | null;
    compliance: Array<{
      severity: string; within_sla: number; breached: number;
      total: number; compliance_pct: number; sla_days: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/sla-compliance', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  trend: async (months = 12, location?: string, environment?: string): Promise<{
    trend: Array<{
      run_id: number; month: string; completed_at: string | null;
      critical: number; high: number; total: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/trend', {
      params: { months, location, environment },
    });
    return response.data;
  },

  heatmap: async (runId?: number, location?: string, environment?: string): Promise<{
    run_id: number | null;
    heatmap: Array<{ asset_criticality: string; critical: number; high: number; medium: number; low: number }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/heatmap', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  internetFacing: async (runId?: number, location?: string, environment?: string): Promise<{
    run_id: number | null;
    total_internet_facing: number;
    critical_high_count: number;
    top_assets: Array<{
      ip: string; dns: string | null; owner: string | null; criticality: string | null;
      total: number; critical: number; high: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/internet-facing', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  ageing: async (runId?: number, location?: string, environment?: string): Promise<{
    run_id: number | null;
    age_available: boolean;
    buckets: Array<{ bucket: string; critical: number; high: number; medium: number; low: number }>;
    avg_age: Array<{ severity: string; avg_days: number; count: number }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/ageing', {
      params: { run_id: runId, location, environment },
    });
    return response.data;
  },

  ageingFindings: async (params: {
    runId?: number; location?: string; environment?: string; minDays?: number; maxDays?: number;
    page?: number; perPage?: number;
  }): Promise<{
    run_id: number | null;
    items: Array<{
      days_open: number; severity: string; ip: string | null; dns: string | null;
      cve_id: string | null; title: string | null; location: string | null;
      first_detected: string | null;
    }>;
    pagination: { page: number; per_page: number; total: number; pages: number };
  }> => {
    const response = await axiosInstance.get('/vulnerability/ageing/findings', {
      params: {
        run_id: params.runId, location: params.location, environment: params.environment,
        min_days: params.minDays, max_days: params.maxDays,
        page: params.page, per_page: params.perPage,
      },
    });
    return response.data;
  },

  ageingFindingsExport: async (params: {
    runId?: number; location?: string; environment?: string;
    minDays?: number; maxDays?: number;
  }): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.get('/vulnerability/ageing/findings/export', {
      params: {
        run_id: params.runId, location: params.location, environment: params.environment,
        min_days: params.minDays, max_days: params.maxDays,
      },
      responseType: 'blob',
    });
    // pull the server-suggested filename out of Content-Disposition
    const cd = response.headers['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/.exec(cd);
    return { blob: response.data as Blob, filename: match?.[1] || 'ageing_vulnerabilities.csv' };
  },

  locationStats: async (runId?: number): Promise<{
    run_id: number | null;
    location_available: boolean;
    locations: Array<{
      location: string; asset_count: number; total_vulns: number;
      critical: number; high: number; medium: number; low: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/location-stats', {
      params: runId !== undefined ? { run_id: runId } : undefined,
    });
    return response.data;
  },

  environmentStats: async (runId?: number): Promise<{
    run_id: number | null;
    environment_available: boolean;
    environments: Array<{
      environment: string; asset_count: number; total_vulns: number;
      critical: number; high: number; medium: number; low: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/vulnerability/environment-stats', {
      params: runId !== undefined ? { run_id: runId } : undefined,
    });
    return response.data;
  },
};

// ===== Superset API =====

export const supersetApi = {
  guestToken: async (runId?: number): Promise<SupersetTokenResponse> => {
    const response = await axiosInstance.get<SupersetTokenResponse>('/superset/guest-token', {
      params: runId !== undefined ? { run_id: runId } : undefined,
    });
    return response.data;
  },
  customize: async (): Promise<SupersetCustomizeResponse> => {
    const response = await axiosInstance.get<SupersetCustomizeResponse>('/superset/customize');
    return response.data;
  },
};

/**
 * Open the customer's private Superset dashboard in the editor (new tab).
 * Provisions the workspace, then writes a one-time auto-submitting login form so
 * the new tab gets a real Superset session on Superset's own origin, landing in
 * edit mode.
 */
export async function openSupersetEditor(): Promise<void> {
  const ws = await supersetApi.customize();
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Popup blocked — allow popups for this site to customize the dashboard.');
  }
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // FAB reads the post-login redirect from the ?next= query param (must be a
  // local/relative path for its safe-redirect check).
  const action = `${ws.superset_domain}/login/?next=${encodeURIComponent(ws.edit_path)}`;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Opening editor…</title></head>
<body style="font-family:system-ui;padding:2rem;color:#334155">Opening your dashboard editor…
<form id="f" method="POST" action="${esc(action)}">
  <input type="hidden" name="username" value="${esc(ws.username)}">
  <input type="hidden" name="password" value="${esc(ws.password)}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`);
  win.document.close();
}

export default axiosInstance;
