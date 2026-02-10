# Dashboard Frontend Architecture - Complete Megaprompt

## 🎯 Executive Summary

This document provides an exhaustive, implementation-level specification of an infrastructure automation dashboard built with React, TypeScript, and Tailwind CSS. This dashboard serves as the central command center for monitoring and managing Ansible playbook executions across multiple servers, providing real-time analytics, customizable visualizations, and comprehensive job tracking.

**Tech Stack:**
- **Frontend Framework**: React 18.2+ with TypeScript 5.3+
- **Build Tool**: Vite 6.4+
- **Styling**: Tailwind CSS 3.3+ with custom design system
- **State Management**: Zustand 4.4+
- **HTTP Client**: Axios 1.6+
- **Charts**: Recharts 3.7+
- **Icons**: Lucide React 0.294+
- **Real-time**: Socket.IO Client 4.8+
- **Routing**: React Router DOM 6.21+

---

## 📐 Architecture Overview

### Application Structure
```
frontend/
├── src/
│   ├── pages/
│   │   └── Dashboard/
│   │       └── Dashboard.tsx          # Main dashboard component
│   ├── components/
│   │   ├── DynamicChart/             # Reusable chart component
│   │   ├── StatusBadge/              # Job status indicator
│   │   ├── Navbar/                   # Top navigation
│   │   ├── Sidebar/                  # Side navigation
│   │   ├── Notifications/            # Toast notifications
│   │   └── NotificationBell/         # Real-time notifications
│   ├── api/
│   │   ├── api.ts                    # Centralized API client
│   │   └── mockApi.ts                # Mock data for demos
│   ├── store/
│   │   ├── authStore.ts              # Authentication state
│   │   ├── uiStore.ts                # UI preferences
│   │   └── themeStore.ts             # Theme management
│   ├── types/
│   │   └── index.ts                  # TypeScript definitions
│   ├── utils/
│   │   └── timezone.ts               # Timezone utilities
│   └── services/
│       ├── socket.service.ts         # WebSocket service
│       └── websocket.ts              # WebSocket connection
├── index.css                          # Global styles
├── tailwind.config.js                 # Tailwind configuration
└── package.json                       # Dependencies
```

### Design Philosophy
1. **Component-Based Architecture**: Modular, reusable components
2. **Type Safety**: Strict TypeScript with comprehensive type definitions
3. **State Management**: Centralized state with Zustand (lightweight, hook-based)
4. **API-First**: Backend-driven data with real-time updates
5. **Responsive Design**: Mobile-first with Tailwind utilities
6. **Performance**: Lazy loading, memoization, efficient re-renders
7. **User Experience**: Real-time updates, graceful loading states, error handling

---

## 🎨 Design System

### Color Palette (Tailwind Extended)
```javascript
colors: {
  primary: {
    50: '#EBF5FF',   // Lightest blue
    100: '#D6EBFF',
    200: '#ADDBFF',
    300: '#75C2FF',
    400: '#3DA3F5',
    500: '#1A7FDB',  // Primary brand color
    600: '#0D52BD',
    700: '#0A4299',
    800: '#073375',
    900: '#052451',  // Darkest blue
  },
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',  // Green for success states
    600: '#059669',
    700: '#047857',
  },
  warning: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    500: '#F59E0B',  // Orange for warnings
    600: '#D97706',
    700: '#B45309',
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',  // Red for errors
    600: '#DC2626',
    700: '#B91C1C',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',  // Blue for informational states
    600: '#2563EB',
    700: '#1D4ED8',
  },
}
```

### Custom Shadows (Glowing Effects)
```javascript
boxShadow: {
  'glow': '0 0 15px rgba(13, 82, 189, 0.3)',      // Standard glow
  'glow-sm': '0 0 10px rgba(13, 82, 189, 0.2)',   // Subtle glow
  'glow-lg': '0 0 25px rgba(13, 82, 189, 0.4)',   // Large glow
  'glow-xl': '0 0 35px rgba(13, 82, 189, 0.5)',   // Extra large glow
}
```

### Custom Animations
```css
/* Slide-in animation for notifications */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Slow spin for refresh indicators */
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Gradient animation for backgrounds */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

---

## 📊 TypeScript Type System

### Core Data Types

```typescript
// ===== JOB TYPES =====
type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

interface Job {
  id: number;
  job_id: string;                    // UUID-style identifier
  parent_job_id?: number;             // For batch jobs
  is_batch_job: boolean;              // Indicates multi-server execution
  batch_config?: BatchConfig;
  playbook_id: number;
  server_id: number;
  user_id: number;
  status: JobStatus;
  celery_task_id?: string;           // Async task tracking
  extra_vars?: Record<string, any>;  // Ansible variables
  error_message?: string;
  patch_report?: string;
  started_at?: string;               // ISO 8601 timestamp
  completed_at?: string;
  created_at: string;
  child_count?: number;              // Number of child jobs in batch
  playbook?: {
    id: number;
    name: string;
  };
  server?: {
    id: number;
    hostname: string;
    ip_address: string;
  };
  user?: {
    id: number;
    username: string;
  };
  parent?: {
    id: number;
    job_id: string;
    is_batch_job: boolean;
  };
}

interface JobStatistics {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  success_rate: number;              // Percentage (0-100)
}

// ===== SERVER TYPES =====
interface Server {
  id: number;
  hostname: string;
  ip_address: string;
  os_type: string;                   // e.g., "Ubuntu", "CentOS", "Windows"
  os_version?: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path?: string;
  tags?: string[];                   // e.g., ["production", "web-server"]
  environment?: 'dev' | 'staging' | 'production';
  description?: string;
  is_active: boolean;
  cpu_usage?: number;                // Percentage
  memory_usage?: number;             // Percentage
  disk_usage?: number;               // Percentage
  last_monitored?: string;           // ISO 8601 timestamp
  created_at: string;
  updated_at: string;
}

// ===== PLAYBOOK TYPES =====
interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;                     // Bytes
  extension?: string;
  children?: FileTreeNode[];         // Recursive structure
}

interface Playbook {
  id: number;
  name: string;
  description?: string;
  file_path: string;                 // Server-side path
  is_folder: boolean;                // True for ZIP/folder uploads
  main_playbook_file?: string;       // Entry point for folder playbooks
  file_structure?: FileTreeNode;     // Tree representation
  file_count: number;
  total_size_kb: number;
  file_hash: string;                 // SHA-256 for version tracking
  tags?: Record<string, any>;
  variables?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== BATCH JOB TYPES =====
type ExecutionStrategy = 'parallel' | 'sequential';

interface BatchConfig {
  concurrent_limit: number;          // Max parallel executions
  stop_on_failure: boolean;          // Halt on first failure
  execution_strategy: ExecutionStrategy;
  total_servers: number;
  server_ids: number[];
}

// ===== PAGINATION =====
interface PaginationMeta {
  page: number;                      // Current page (1-indexed)
  per_page: number;                  // Items per page
  total: number;                     // Total items
  pages: number;                     // Total pages
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ===== TIME RANGES =====
type TimeRange = '7days' | '30days' | '3months' | '6months' | '1year' | 'all' | 'custom';

// ===== CHART TYPES =====
type ChartType = 'bar' | 'pie' | 'line' | 'donut' | 'area';
type DataMetric = 
  | 'job-status'
  | 'job-success-rate'
  | 'server-os-distribution'
  | 'server-status'
  | 'server-environment';

interface ChartConfig {
  id: string;                        // Unique identifier
  metric: DataMetric;
  chartType: ChartType;
  timeRange: TimeRange;
}

// ===== ANALYTICS TYPES =====
interface AnalyticsData {
  successTrends: {
    trends: Array<{
      period: string;                // Date string
      total_jobs: number;
      success_rate: number;          // Percentage
    }>;
  };
  executionTimes: {
    playbooks: Array<{
      playbook_name: string;
      total_executions: number;
      avg_duration_formatted: string; // e.g., "2m 30s"
    }>;
  };
  failureAnalysis: {
    by_playbook: Array<{
      playbook_name: string;
      failure_count: number;
      affected_servers: number;
    }>;
    by_server: Array<{
      server_hostname: string;
      failure_count: number;
      affected_playbooks: number;
    }>;
    summary: {
      total_jobs: number;
      total_failures: number;
      failure_rate: number;          // Percentage
    };
  };
}
```

---

## 🔌 API Integration Layer

### API Client Configuration

```typescript
// Base setup with Axios
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30 seconds
});

// Request interceptor - JWT authentication
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

// Response interceptor - automatic token refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post<TokenResponse>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );
        
        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### Dashboard API Endpoints

```typescript
// Job Statistics
jobsApi.getStatistics(): Promise<JobStatistics>
// GET /api/jobs/statistics
// Returns: { total, pending, running, success, failed, cancelled, success_rate }

// Recent Jobs List
jobsApi.list(filters: JobFilters): Promise<PaginatedResponse<Job>>
// GET /api/jobs?page=1&per_page=10
// Supports filters: status, playbook_id, server_id, user_id

// Server List
serversApi.list(filters: ServerFilters): Promise<PaginatedResponse<Server>>
// GET /api/servers?page=1&per_page=100
// Supports filters: is_active, environment, os_type, search

// Playbook List
playbooksApi.list(filters: PlaybookFilters): Promise<PaginatedResponse<Playbook>>
// GET /api/playbooks?page=1&per_page=100
// Supports filters: is_active, search

// Analytics - Success Rate Trends
jobsApi.getSuccessRateTrends(params: {
  time_range: TimeRange;
  granularity: 'daily' | 'weekly' | 'monthly';
  start_date?: string;  // For custom range
  end_date?: string;
}): Promise<SuccessRateTrendsResponse>
// GET /api/jobs/analytics/success-rate-trends

// Analytics - Execution Time Analysis
jobsApi.getExecutionTimeAnalytics(params: {
  time_range: TimeRange;
  start_date?: string;
  end_date?: string;
}): Promise<ExecutionTimeResponse>
// GET /api/jobs/analytics/execution-time

// Analytics - Failure Analysis
jobsApi.getFailureAnalysis(params: {
  time_range: TimeRange;
  group_by: 'playbook' | 'server' | 'both';
  start_date?: string;
  end_date?: string;
}): Promise<FailureAnalysisResponse>
// GET /api/jobs/analytics/failure-analysis

// Export Analytics (PDF/CSV)
jobsApi.exportAnalytics(params: {
  format: 'pdf' | 'csv';
  time_range: TimeRange;
  start_date?: string;
  end_date?: string;
}): Promise<Blob>
// GET /api/jobs/analytics/export?format=pdf
// Returns downloadable file blob
```

---

## 🎭 State Management (Zustand)

### Authentication Store

```typescript
// store/authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  
  login: async (credentials) => {
    const response = await authApi.login(credentials);
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    set({ user: response.user, isAuthenticated: true });
  },
  
  logout: async () => {
    await authApi.logout();
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },
  
  loadUser: async () => {
    set({ isLoading: true });
    try {
      const user = await authApi.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
```

### UI Store (Sidebar, Preferences)

```typescript
// store/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

---

## 📱 Dashboard Component Breakdown

### 1. Main Dashboard Component Structure

**File:** `src/pages/Dashboard/Dashboard.tsx`

**Component Hierarchy:**
```
Dashboard
├── Header Section
├── Statistics Cards Grid (4 cards)
│   ├── Servers Card
│   ├── Playbooks Card
│   ├── Total Jobs Card
│   └── Success Rate Card
├── Job Status Overview Panel
├── Advanced Analytics Section (conditional)
│   ├── Analytics Toolbar
│   │   ├── Time Range Selector
│   │   ├── Custom Date Range Inputs
│   │   ├── Auto-Refresh Toggle
│   │   └── Export Buttons (PDF/CSV)
│   ├── Analytics Cards Grid (2x2)
│   │   ├── Success Rate Trends
│   │   ├── Execution Time by Playbook
│   │   ├── Top Failing Playbooks
│   │   └── Top Failing Servers
│   └── Failure Summary Banner
├── Customizable Charts Section
│   ├── Chart Management Toolbar
│   │   ├── Global Time Range Filter
│   │   ├── Apply to All Button
│   │   └── Add Chart Button
│   └── Dynamic Charts Grid
│       └── DynamicChart[] (user-configurable)
└── Recent Jobs Table
    └── Job Rows with Status Badges
```

### 2. State Management in Dashboard

```typescript
// Local component state
const [stats, setStats] = useState<JobStatistics | null>(null);
const [recentJobs, setRecentJobs] = useState<Job[]>([]);
const [serverCount, setServerCount] = useState(0);
const [playbookCount, setPlaybookCount] = useState(0);
const [loading, setLoading] = useState(true);
const [servers, setServers] = useState<ServerType[]>([]);
const [allJobs, setAllJobs] = useState<Job[]>([]);

// Chart management
const [charts, setCharts] = useState<ChartConfig[]>([
  { id: '1', metric: 'job-status', chartType: 'bar', timeRange: 'all' },
  { id: '2', metric: 'job-success-rate', chartType: 'pie', timeRange: 'all' },
]);
const [globalTimeRange, setGlobalTimeRange] = useState<TimeRange>('30days');

// Advanced analytics
const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
const [analyticsLoading, setAnalyticsLoading] = useState(false);
const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30days');
const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
const [autoRefresh, setAutoRefresh] = useState(false);
const [exportingPDF, setExportingPDF] = useState(false);
const [exportingCSV, setExportingCSV] = useState(false);
```

### 3. Data Loading Lifecycle

```typescript
// Initial load on mount
useEffect(() => {
  loadDashboardData();
  loadAnalyticsData();
}, []);

// Auto-refresh mechanism (30-second interval)
useEffect(() => {
  if (!autoRefresh) return;
  
  const interval = setInterval(() => {
    loadDashboardData();
    loadAnalyticsData();
  }, 30000); // 30 seconds
  
  return () => clearInterval(interval);
}, [autoRefresh, selectedTimeRange]);

// Main data loading function
const loadDashboardData = async () => {
  try {
    setLoading(true);
    
    const api = isDemoMode ? mockApi : {
      jobs: jobsApi,
      servers: serversApi,
      playbooks: playbooksApi,
    };
    
    // Parallel data fetching for performance
    const [jobStats, jobsResponse, serversResponse, playbooksResponse, 
           allServers, allJobsResponse] = await Promise.all([
      api.jobs.getStatistics(),
      api.jobs.list({ page: 1, per_page: 10 }),
      api.servers.list({ page: 1, per_page: 1 }),      // Count only
      api.playbooks.list({ page: 1, per_page: 1 }),    // Count only
      api.servers.list({ page: 1, per_page: 100 }),    // For charts
      api.jobs.list({ page: 1, per_page: 1000 }),      // For filtering
    ]);

    setStats(jobStats);
    setRecentJobs(jobsResponse.items);
    setServerCount(serversResponse.pagination?.total || 0);
    setPlaybookCount(playbooksResponse.pagination?.total || 0);
    setServers(allServers.items || []);
    setAllJobs(allJobsResponse.items || []);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  } finally {
    setLoading(false);
  }
};

// Analytics data loading
const loadAnalyticsData = async () => {
  if (isDemoMode) return;
  
  try {
    setAnalyticsLoading(true);
    
    const params = {
      time_range: selectedTimeRange,
      ...(selectedTimeRange === 'custom' && customDateRange.start && customDateRange.end
        ? { start_date: customDateRange.start, end_date: customDateRange.end }
        : {}),
    };
    
    // Parallel analytics requests
    const [successTrends, executionTimes, failureAnalysis] = await Promise.all([
      jobsApi.getSuccessRateTrends({ ...params, granularity: 'daily' }),
      jobsApi.getExecutionTimeAnalytics(params),
      jobsApi.getFailureAnalysis({ ...params, group_by: 'both' }),
    ]);
    
    setAnalyticsData({
      successTrends,
      executionTimes,
      failureAnalysis,
    });
  } catch (error) {
    console.error('Failed to load analytics data:', error);
  } finally {
    setAnalyticsLoading(false);
  }
};
```

### 4. Time Range Filtering Logic

```typescript
// Client-side job filtering by time range
const filterJobsByTimeRange = (jobs: Job[], timeRange: TimeRange): Job[] => {
  if (timeRange === 'all') return jobs;

  const now = new Date();
  const cutoffDate = new Date();

  switch (timeRange) {
    case '7days':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '30days':
      cutoffDate.setDate(now.getDate() - 30);
      break;
    case '3months':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6months':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1year':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return jobs.filter((job) => {
    // Use completion date if available, otherwise creation date
    const jobDate = job.completed_at 
      ? new Date(job.completed_at) 
      : new Date(job.created_at);
    return jobDate >= cutoffDate;
  });
};

// Calculate statistics for filtered jobs
const calculateFilteredStats = (jobs: Job[]) => {
  const pending = jobs.filter(j => j.status === 'pending').length;
  const running = jobs.filter(j => j.status === 'running').length;
  const success = jobs.filter(j => j.status === 'success').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const cancelled = jobs.filter(j => j.status === 'cancelled').length;

  return { pending, running, success, failed, cancelled };
};
```

### 5. Chart Data Preparation

```typescript
// Prepare data for all chart types based on time range
const prepareChartData = (timeRange: TimeRange = 'all') => {
  if (!stats) return {};

  const filteredJobs = filterJobsByTimeRange(allJobs, timeRange);
  const filteredStats = calculateFilteredStats(filteredJobs);

  // Job Status Distribution (for bar/pie charts)
  const jobStatusData = [
    { name: 'Pending', value: filteredStats.pending || 0 },
    { name: 'Running', value: filteredStats.running || 0 },
    { name: 'Success', value: filteredStats.success || 0 },
    { name: 'Failed', value: filteredStats.failed || 0 },
    { name: 'Cancelled', value: filteredStats.cancelled || 0 },
  ];

  // Server OS Distribution
  const osCount: Record<string, number> = {};
  servers.forEach((server) => {
    const os = server.os_type || 'Unknown';
    osCount[os] = (osCount[os] || 0) + 1;
  });
  const serverOsData = Object.entries(osCount).map(([name, value]) => ({
    name,
    value,
  }));

  // Server Status (Active/Inactive)
  const activeCount = servers.filter((s) => s.is_active).length;
  const inactiveCount = servers.length - activeCount;
  const serverStatusData = [
    { name: 'Active', value: activeCount },
    { name: 'Inactive', value: inactiveCount },
  ];

  // Server Environment Distribution
  const envCount: Record<string, number> = {};
  servers.forEach((server) => {
    const env = server.environment || 'unassigned';
    envCount[env] = (envCount[env] || 0) + 1;
  });
  const serverEnvironmentData = Object.entries(envCount).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    'job-status': jobStatusData,
    'job-success-rate': jobStatusData,  // Can be customized
    'server-os-distribution': serverOsData,
    'server-status': serverStatusData,
    'server-environment': serverEnvironmentData,
  };
};
```

### 6. Chart Management Functions

```typescript
// Add a new chart to the dashboard
const handleAddChart = () => {
  const newChart: ChartConfig = {
    id: Date.now().toString(),
    metric: 'job-status',
    chartType: 'bar',
    timeRange: 'all',
  };
  setCharts([...charts, newChart]);
};

// Remove chart by ID
const handleRemoveChart = (id: string) => {
  setCharts(charts.filter((chart) => chart.id !== id));
};

// Update chart metric (what data to show)
const handleMetricChange = (id: string, metric: DataMetric) => {
  setCharts(charts.map((chart) => 
    chart.id === id ? { ...chart, metric } : chart
  ));
};

// Update chart visualization type
const handleChartTypeChange = (id: string, chartType: ChartType) => {
  setCharts(charts.map((chart) => 
    chart.id === id ? { ...chart, chartType } : chart
  ));
};

// Update individual chart time range
const handleTimeRangeChange = (id: string, timeRange: TimeRange) => {
  setCharts(charts.map((chart) => 
    chart.id === id ? { ...chart, timeRange } : chart
  ));
};

// Apply global time range to all charts
const handleApplyToAllCharts = () => {
  setCharts(charts.map((chart) => 
    ({ ...chart, timeRange: globalTimeRange })
  ));
};
```

### 7. Analytics Export Functions

```typescript
// Export analytics as PDF
const handleExportPDF = async () => {
  try {
    setExportingPDF(true);
    const params = {
      format: 'pdf' as const,
      time_range: selectedTimeRange,
      ...(selectedTimeRange === 'custom' && customDateRange.start && customDateRange.end
        ? { start_date: customDateRange.start, end_date: customDateRange.end }
        : {}),
    };
    
    const blob = await jobsApi.exportAnalytics(params);
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    alert('Failed to export PDF. Please try again.');
  } finally {
    setExportingPDF(false);
  }
};

// Export analytics as CSV (same pattern)
const handleExportCSV = async () => {
  // Similar implementation with format: 'csv'
  // ...
};
```

---

## 🧩 Reusable Components

### DynamicChart Component

**File:** `src/components/DynamicChart/DynamicChart.tsx`

**Purpose:** Highly flexible chart component with runtime configuration

**Features:**
- Multiple chart types (bar, pie, line, donut, area)
- Configurable data metrics
- Individual time range filtering
- Real-time data updates
- Remove/edit capabilities

**Props Interface:**
```typescript
interface DynamicChartProps {
  chartId: string;              // Unique identifier
  initialMetric: DataMetric;    // Starting data source
  initialChartType: ChartType;  // Starting visualization
  initialTimeRange: TimeRange;  // Starting time filter
  data: any;                    // Chart data object
  onRemove: (id: string) => void;
  onMetricChange: (id: string, metric: DataMetric) => void;
  onChartTypeChange: (id: string, type: ChartType) => void;
  onTimeRangeChange: (id: string, timeRange: TimeRange) => void;
}
```

**Component Structure:**
```typescript
export const DynamicChart: React.FC<DynamicChartProps> = ({
  chartId,
  initialMetric,
  initialChartType,
  initialTimeRange,
  data,
  onRemove,
  onMetricChange,
  onChartTypeChange,
  onTimeRangeChange,
}) => {
  const [metric, setMetric] = useState<DataMetric>(initialMetric);
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMetric = e.target.value as DataMetric;
    setMetric(newMetric);
    onMetricChange(chartId, newMetric);
  };

  // Similar handlers for chartType and timeRange...

  const renderChart = () => {
    const chartData = data[metric] || [];

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#764ba2" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                style={{ fontSize: '12px', fontWeight: 500 }} 
              />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
              <Bar 
                dataKey="value" 
                fill="url(#colorBar)" 
                radius={[8, 8, 0, 0]}
                animationDuration={800}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getColorByName(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                animationDuration={800}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getColorByName(entry.name)} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      // Other chart types: line, donut, area...
    }
  };

  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric Selector */}
          <select
            value={metric}
            onChange={handleMetricChange}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="job-status">Jobs by Status</option>
            <option value="job-success-rate">Job Success Rate</option>
            <option value="server-os-distribution">Server OS Distribution</option>
            <option value="server-status">Server Status</option>
            <option value="server-environment">Server Environment</option>
          </select>

          {/* Chart Type Selector */}
          <select
            value={chartType}
            onChange={handleChartTypeChange}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="bar">Bar Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="line">Line Chart</option>
            <option value="donut">Donut Chart</option>
            <option value="area">Area Chart</option>
          </select>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={handleTimeRangeChange}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="3months">Last 3 months</option>
            <option value="6months">Last 6 months</option>
            <option value="1year">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(chartId)}
          className="p-1.5 text-gray-400 hover:text-error-500 hover:bg-error-50 rounded transition-colors"
          title="Remove chart"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Chart Rendering */}
      <div className="mt-4">
        {renderChart()}
      </div>
    </div>
  );
};
```

**Color Mapping for Consistency:**
```typescript
const STATUS_COLORS: Record<string, string> = {
  'Pending': '#9CA3AF',   // Light Gray
  'Running': '#60A5FA',   // Light Blue/Info
  'Success': '#34D399',   // Light Green
  'Failed': '#F87171',    // Light Red/Error
  'Cancelled': '#FBBF24', // Light Orange/Warning
};

const getColorByName = (name: string): string => {
  return STATUS_COLORS[name] || '#8B5CF6'; // Default to primary
};
```

---

### StatusBadge Component

**File:** `src/components/StatusBadge/StatusBadge.tsx`

**Purpose:** Consistent visual representation of job statuses

```typescript
interface StatusBadgeProps {
  status: JobStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<JobStatus, string> = {
    pending: 'bg-gray-100 text-gray-700 border-gray-300',
    running: 'bg-info-100 text-info-700 border-info-300',
    success: 'bg-success-100 text-success-700 border-success-300',
    failed: 'bg-error-100 text-error-700 border-error-300',
    cancelled: 'bg-warning-100 text-warning-700 border-warning-300',
  };

  const icons: Record<JobStatus, React.ReactNode> = {
    pending: <AlertCircle className="h-3 w-3" />,
    running: <Clock className="h-3 w-3 animate-spin-slow" />,
    success: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    cancelled: <AlertTriangle className="h-3 w-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
```

---

### Navbar Component

**File:** `src/components/Navbar/Navbar.tsx`

**Features:**
- User profile dropdown with account details
- Notification bell (real-time)
- Logout functionality
- Responsive sidebar toggle

```typescript
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
    await logout();
    window.location.href = '/login';
  };

  return (
    <nav className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 shadow-glow px-4 py-3 flex items-center justify-between">
      {/* Menu Button */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-md hover:bg-gray-200 transition-colors"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {/* Title */}
      <h1 className="text-xl font-bold text-gray-900">
        INFRASTRUCTURE AUTOMATION HUB
      </h1>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-gray-600 capitalize">{user.role}</p>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-glow-lg border py-2 z-50">
                {/* User Info Section */}
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold">{user.username}</p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded text-xs bg-primary-500 text-white capitalize">
                    {user.role}
                  </span>
                </div>

                {/* Account Details */}
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-500 mb-1">Account Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">User ID:</span>
                      <span className="font-medium">{user.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={user.is_active ? 'text-success-600' : 'text-error-600'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="border-t mt-2 pt-2 px-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-600 hover:bg-error-50 rounded-md"
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
```

---

## 🎨 Dashboard UI Sections (Detailed)

### Section 1: Statistics Cards Grid

**Layout:** 4-column responsive grid (1 column on mobile, 2 on tablet, 4 on desktop)

**Card Structure (Example: Servers Card):**
```tsx
<div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6 transition-all hover:shadow-glow-lg">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-600">Servers</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{serverCount}</p>
    </div>
    <div className="p-3 bg-primary-100 rounded-lg">
      <Server className="h-6 w-6 text-primary-600" />
    </div>
  </div>
  <Link 
    to="/servers" 
    className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block font-medium"
  >
    View all servers →
  </Link>
</div>
```

**Cards Included:**
1. **Servers Card** - Total server count, links to /servers
2. **Playbooks Card** - Total playbook count, links to /playbooks
3. **Total Jobs Card** - Total jobs + running jobs count
4. **Success Rate Card** - Percentage with successful jobs count

---

### Section 2: Job Status Overview

**Layout:** Horizontal row of 5 status indicators

```tsx
<div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status Overview</h3>
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
    {/* Pending */}
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
        <span className="text-2xl font-bold text-gray-700">{stats.pending}</span>
      </div>
      <p className="text-sm text-gray-600">Pending</p>
    </div>

    {/* Running */}
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <Clock className="h-5 w-5 text-info-500 mr-2" />
        <span className="text-2xl font-bold text-info-700">{stats.running}</span>
      </div>
      <p className="text-sm text-gray-600">Running</p>
    </div>

    {/* Success, Failed, Cancelled (similar pattern) */}
  </div>
</div>
```

---

### Section 3: Advanced Analytics & Insights

**Conditional Rendering:** Only shown when `!isDemoMode`

**Toolbar Controls:**
```tsx
<div className="flex flex-wrap items-center gap-3">
  {/* Time Range Filter */}
  <div className="flex items-center gap-2">
    <Calendar className="h-4 w-4 text-gray-500" />
    <select
      value={selectedTimeRange}
      onChange={(e) => handleAnalyticsTimeRangeChange(e.target.value as TimeRange)}
      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
    >
      <option value="7days">Last 7 days</option>
      <option value="30days">Last 30 days</option>
      <option value="3months">Last 3 months</option>
      <option value="custom">Custom Range</option>
    </select>
  </div>

  {/* Custom Date Range (conditional) */}
  {selectedTimeRange === 'custom' && (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={customDateRange.start}
        onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
        className="px-3 py-2 border rounded-lg"
      />
      <span className="text-gray-500">to</span>
      <input
        type="date"
        value={customDateRange.end}
        onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
        className="px-3 py-2 border rounded-lg"
      />
      <button
        onClick={handleCustomDateChange}
        className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
      >
        Apply
      </button>
    </div>
  )}

  {/* Auto Refresh Toggle */}
  <button
    onClick={toggleAutoRefresh}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      autoRefresh ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
    Auto
  </button>

  {/* Export Buttons */}
  <button
    onClick={handleExportPDF}
    disabled={exportingPDF}
    className="flex items-center gap-2 px-3 py-2 bg-error-500 text-white rounded-lg hover:bg-error-600"
  >
    <Download className="h-4 w-4" />
    {exportingPDF ? 'Exporting...' : 'PDF'}
  </button>

  <button
    onClick={handleExportCSV}
    disabled={exportingCSV}
    className="flex items-center gap-2 px-3 py-2 bg-success-500 text-white rounded-lg"
  >
    <Download className="h-4 w-4" />
    {exportingCSV ? 'Exporting...' : 'CSV'}
  </button>
</div>
```

**Analytics Cards (2x2 Grid):**

1. **Success Rate Trends**
```tsx
<div className="bg-white rounded-lg p-5 border border-gray-200">
  <div className="flex items-center gap-2 mb-4">
    <TrendingUp className="h-5 w-5 text-success-600" />
    <h4 className="font-semibold text-gray-900">Success Rate Trends</h4>
  </div>
  {analyticsData.successTrends?.trends?.length > 0 ? (
    <div className="space-y-2">
      {analyticsData.successTrends.trends.slice(0, 7).map((trend: any, index: number) => (
        <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
          <span className="text-sm text-gray-600">{trend.period}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{trend.total_jobs} jobs</span>
            <span className={`text-sm font-bold ${
              trend.success_rate >= 80 ? 'text-success-600' : 
              trend.success_rate >= 60 ? 'text-warning-600' : 'text-error-600'
            }`}>
              {trend.success_rate}%
            </span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-gray-500 py-4">No data available for this period</p>
  )}
</div>
```

2. **Average Execution Time by Playbook** (similar structure)
3. **Top Failing Playbooks** (similar structure)
4. **Top Failing Servers** (similar structure)

**Failure Summary Banner (Full Width):**
```tsx
<div className="lg:col-span-2 bg-gradient-to-r from-error-50 to-warning-50 rounded-lg p-5 border border-error-200">
  <div className="grid grid-cols-3 gap-4">
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">
        {analyticsData.failureAnalysis.summary.total_jobs}
      </p>
      <p className="text-sm text-gray-600 mt-1">Total Jobs</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-error-600">
        {analyticsData.failureAnalysis.summary.total_failures}
      </p>
      <p className="text-sm text-gray-600 mt-1">Total Failures</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-warning-600">
        {analyticsData.failureAnalysis.summary.failure_rate}%
      </p>
      <p className="text-sm text-gray-600 mt-1">Failure Rate</p>
    </div>
  </div>
</div>
```

---

### Section 4: Customizable Charts

**Toolbar:**
```tsx
<div className="flex flex-wrap items-center gap-3">
  {/* Global Time Range */}
  <select
    value={globalTimeRange}
    onChange={(e) => setGlobalTimeRange(e.target.value as TimeRange)}
    className="px-3 py-2 bg-white border rounded-lg"
  >
    <option value="7days">Last 7 days</option>
    <option value="30days">Last 30 days</option>
    <option value="all">All time</option>
    {/* ... */}
  </select>

  {/* Apply to All Charts */}
  <button
    onClick={handleApplyToAllCharts}
    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
  >
    Apply to All
  </button>

  {/* Add Chart */}
  <button
    onClick={handleAddChart}
    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg shadow-sm"
  >
    <Plus className="h-4 w-4" />
    Add Chart
  </button>
</div>
```

**Charts Grid (2 columns on large screens):**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {charts.map((chart) => (
    <DynamicChart
      key={chart.id}
      chartId={chart.id}
      initialMetric={chart.metric}
      initialChartType={chart.chartType}
      initialTimeRange={chart.timeRange}
      data={prepareChartData(chart.timeRange)}
      onRemove={handleRemoveChart}
      onMetricChange={handleMetricChange}
      onChartTypeChange={handleChartTypeChange}
      onTimeRangeChange={handleTimeRangeChange}
    />
  ))}
</div>

{/* Empty State */}
{charts.length === 0 && (
  <div className="bg-white border rounded-lg p-12 text-center">
    <p className="text-gray-500 mb-4">No charts added yet</p>
    <button
      onClick={handleAddChart}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg"
    >
      <Plus className="h-4 w-4" />
      Add Your First Chart
    </button>
  </div>
)}
```

---

### Section 5: Recent Jobs Table

**Table Structure:**
```tsx
<div className="bg-white border border-primary-200 shadow-glow rounded-lg">
  <div className="px-6 py-4 border-b border-gray-200">
    <h3 className="text-lg font-semibold text-gray-900">Recent Jobs</h3>
  </div>
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Job ID
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Playbook
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Server
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Created
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {recentJobs.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
              No jobs found
            </td>
          </tr>
        ) : (
          recentJobs.map((job) => (
            <tr key={job.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {job.job_id.substring(0, 8)}...
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {job.playbook?.name || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {job.server?.hostname || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {new Intl.DateTimeFormat('en-US', {
                  timeZone: getUserTimezone(),
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }).format(new Date(job.created_at))}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <Link
                  to={`/jobs/${job.id}`}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  View details
                </Link>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
```

---

## 🔄 Real-Time Features

### WebSocket Integration

**Service:** `src/services/socket.service.ts`

**Purpose:** Real-time job updates and notifications

```typescript
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(url: string) {
    if (this.socket?.connected) return;

    this.socket = io(url, {
      auth: {
        token: localStorage.getItem('access_token'),
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
    });

    // Re-attach listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
    
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
```

**Events Listened:**
- `job_update` - Job status changes
- `patches_ready` - Interactive patch selection ready
- `notification` - In-app notifications
- `metric_update` - Server metric updates

**Usage in Dashboard:**
```typescript
useEffect(() => {
  if (isAuthenticated) {
    // Listen for job updates
    const handleJobUpdate = (data: { job_id: string; status: JobStatus }) => {
      console.log('[Dashboard] Job update:', data);
      // Refresh dashboard data
      loadDashboardData();
    };

    socketService.on('job_update', handleJobUpdate);
    socketService.connect(wsUrl);

    return () => {
      socketService.off('job_update', handleJobUpdate);
      socketService.disconnect();
    };
  }
}, [isAuthenticated]);
```

---

## 🌐 Timezone Handling

**Utility:** `src/utils/timezone.ts`

```typescript
export const getUserTimezone = (): string => {
  // Try to get from user profile (if stored in backend)
  const storedTimezone = localStorage.getItem('user_timezone');
  if (storedTimezone) return storedTimezone;
  
  // Fallback to browser timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Format date with user's timezone
export const formatDate = (date: string, format: 'short' | 'long' = 'short') => {
  const tz = getUserTimezone();
  const options: Intl.DateTimeFormatOptions = 
    format === 'short'
      ? { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: tz }
      : { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: tz 
        };
  
  return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
};
```

---

## 🎯 Performance Optimizations

### 1. Parallel Data Fetching
```typescript
// Load all dashboard data in parallel
const [jobStats, jobsResponse, serversResponse, playbooksResponse, 
       allServers, allJobsResponse] = await Promise.all([
  api.jobs.getStatistics(),
  api.jobs.list({ page: 1, per_page: 10 }),
  api.servers.list({ page: 1, per_page: 1 }),
  api.playbooks.list({ page: 1, per_page: 1 }),
  api.servers.list({ page: 1, per_page: 100 }),
  api.jobs.list({ page: 1, per_page: 1000 }),
]);
```

### 2. Efficient Re-renders
- Use `React.memo` for chart components
- Memoize heavy computations with `useMemo`
- Debounce search inputs

### 3. Lazy Loading
```typescript
// Load charts only when visible
import { lazy, Suspense } from 'react';

const DynamicChart = lazy(() => import('./components/DynamicChart/DynamicChart'));

// Usage
<Suspense fallback={<div>Loading chart...</div>}>
  <DynamicChart {...props} />
</Suspense>
```

### 4. Virtual Scrolling (for large tables)
```typescript
// Consider react-window for 1000+ rows
import { FixedSizeList } from 'react-window';
```

---

## 🧪 Demo Mode Support

**Environment Variable:** `VITE_DEMO_MODE=true`

**Implementation:**
```typescript
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// Use mock API in demo mode
const api = isDemoMode ? mockApi : {
  jobs: jobsApi,
  servers: serversApi,
  playbooks: playbooksApi,
};

// Hide analytics in demo mode
{!isDemoMode && (
  <AdvancedAnalyticsSection />
)}
```

**Mock API:** `src/api/mockApi.ts`
- Simulates backend responses
- Useful for frontend development without backend
- Demo deployments

---

## 📦 Dependencies Breakdown

```json
{
  "react": "^18.2.0",           // Core framework
  "react-dom": "^18.2.0",        // DOM rendering
  "react-router-dom": "^6.21.0", // Routing
  "typescript": "^5.3.3",        // Type safety
  "vite": "^6.4.1",              // Build tool
  "tailwindcss": "^3.3.6",       // Styling
  "zustand": "^4.4.7",           // State management
  "axios": "^1.6.2",             // HTTP client
  "recharts": "^3.7.0",          // Charts
  "lucide-react": "^0.294.0",    // Icons
  "socket.io-client": "^4.8.3"   // WebSocket
}
```

---

## 🚀 Build & Deployment

### Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Access at http://localhost:5173
```

### Production Build
```bash
# TypeScript compilation + Vite build
npm run build

# Output: dist/
# - index.html
# - assets/ (JS, CSS bundles)
```

### Environment Variables
```env
# .env.development
VITE_API_URL=http://localhost:5000/api
VITE_DEMO_MODE=false

# .env.production
VITE_API_URL=/api
VITE_DEMO_MODE=false
```

---

## 🎨 Styling Best Practices

### Tailwind Utility Patterns

**Card Pattern:**
```tsx
<div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6 hover:shadow-glow-lg transition-all">
  {/* Card content */}
</div>
```

**Button Primary:**
```tsx
<button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm">
  Click Me
</button>
```

**Button Secondary:**
```tsx
<button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
  Cancel
</button>
```

**Input Field:**
```tsx
<input 
  type="text"
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
/>
```

**Table Row Hover:**
```tsx
<tr className="hover:bg-gray-50 transition-colors">
  {/* cells */}
</tr>
```

---

## 🔐 Security Considerations

### 1. JWT Token Management
- Stored in `localStorage` (access_token, refresh_token)
- Automatically attached to API requests via interceptor
- Auto-refresh on 401 response
- Cleared on logout or auth errors

### 2. XSS Protection
- React's built-in escaping
- Avoid `dangerouslySetInnerHTML`
- Sanitize user inputs

### 3. CSRF Protection
- JWT tokens (stateless auth)
- SameSite cookies if using sessions

### 4. HTTPS Only (Production)
- Enforce HTTPS for API calls
- Secure WebSocket (wss://)

---

## 📊 Accessibility (A11Y)

### Semantic HTML
```tsx
<nav aria-label="Main navigation">
  {/* navigation items */}
</nav>

<main role="main">
  {/* dashboard content */}
</main>
```

### ARIA Labels
```tsx
<button
  aria-label="Toggle sidebar"
  onClick={toggleSidebar}
>
  <Menu />
</button>
```

### Keyboard Navigation
- Tab index management
- Focus trapping in modals
- Escape key to close dropdowns

### Screen Reader Support
- Status announcements for job updates
- Alt text for icons with `aria-label`

---

## 🧩 Extension Points

### Adding New Metrics
1. Add metric type to `DataMetric` union in `types/index.ts`
2. Add data preparation in `prepareChartData()`
3. Add label in `DynamicChart` component

### Adding New Chart Type
1. Add type to `ChartType` union
2. Implement rendering in `DynamicChart.renderChart()`
3. Add to chart type selector

### Adding New Analytics Card
1. Create API endpoint for new metric
2. Add to `AnalyticsData` interface
3. Fetch in `loadAnalyticsData()`
4. Render in analytics grid

---

## 📚 Code Organization Principles

1. **Single Responsibility** - Each component does one thing well
2. **DRY (Don't Repeat Yourself)** - Reusable utilities and components
3. **Type Safety** - Comprehensive TypeScript coverage
4. **Separation of Concerns** - API logic separate from UI
5. **Composability** - Small, composable components
6. **Performance First** - Optimistic updates, parallel loading
7. **User Experience** - Loading states, error handling, real-time updates

---

## 🎓 Learning Resources

### React Patterns Used
- **Hooks**: useState, useEffect, useRef, custom hooks
- **Context**: Not used (Zustand for state)
- **Composition**: Component composition over inheritance
- **Controlled Components**: Forms with controlled inputs

### TypeScript Patterns
- **Strict typing**: All props and state typed
- **Union types**: For status, chart types, etc.
- **Interfaces**: For complex object shapes
- **Generics**: For reusable components

### Tailwind Patterns
- **Utility-first**: No custom CSS files
- **Responsive design**: Mobile-first breakpoints
- **Dark mode**: Class-based dark mode support
- **Custom theme**: Extended color palette and shadows

---

## 🚦 Conclusion

This dashboard represents a production-ready, enterprise-grade infrastructure automation interface. It combines:

✅ **Real-time data** via WebSocket  
✅ **Advanced analytics** with time-range filtering  
✅ **Customizable visualizations** with 5 chart types  
✅ **Type-safe codebase** with comprehensive TypeScript  
✅ **Responsive design** for all screen sizes  
✅ **Performance optimized** with parallel loading  
✅ **Secure authentication** with JWT auto-refresh  
✅ **Export capabilities** (PDF/CSV)  
✅ **Demo mode support** for testing  

**Use this megaprompt as a comprehensive blueprint to build similar dashboards in other applications, adapting the data models, API endpoints, and business logic to your specific needs.**

---

## 📝 Quick Start Checklist

To build a similar dashboard:

- [ ] Set up React + TypeScript + Vite project
- [ ] Install dependencies (Tailwind, Recharts, Axios, Zustand, etc.)
- [ ] Configure Tailwind with custom theme
- [ ] Define TypeScript types for your domain
- [ ] Create API client with interceptors
- [ ] Build state management stores (auth, UI)
- [ ] Create reusable components (StatusBadge, DynamicChart)
- [ ] Implement main dashboard with statistics cards
- [ ] Add chart management with time filtering
- [ ] Implement analytics section with export
- [ ] Add recent items table
- [ ] Set up WebSocket for real-time updates
- [ ] Add loading states and error handling
- [ ] Test responsive design
- [ ] Optimize performance
- [ ] Deploy to production

---

**END OF MEGAPROMPT**

*This document contains every implementation detail, pattern, and best practice used in building the infrastructure automation dashboard. Use it as a reference, template, or learning resource for your next project.*
