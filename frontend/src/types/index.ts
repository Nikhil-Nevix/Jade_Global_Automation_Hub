/**
 * TypeScript Type Definitions
 * Matches backend API response structures
 */

// ===== User & Authentication Types =====

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface TokenResponse {
  access_token: string;
}

// ===== Server Types =====

export interface Server {
  id: number;
  hostname: string;
  ip_address: string;
  os_type: string;
  os_version?: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path?: string;
  tags?: string[];  // Array of tag strings like ["production", "web-server"]
  environment?: 'dev' | 'staging' | 'production';
  description?: string;
  is_active: boolean;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  last_monitored?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerCreateRequest {
  hostname: string;
  ip_address: string;
  os_type: string;
  os_version?: string;
  ssh_port?: number;
  ssh_user: string;
  ssh_key_path?: string;
  tags?: string[];
  environment?: string;
  description?: string;
}

export interface ServerUpdateRequest {
  hostname?: string;
  ip_address?: string;
  os_type?: string;
  os_version?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_key_path?: string;
  tags?: string[];
  environment?: string;
  description?: string;
  is_active?: boolean;
}

// ===== Playbook Types =====

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  extension?: string;
  children?: FileTreeNode[];
}

export interface Playbook {
  id: number;
  name: string;
  description?: string;
  file_path: string;
  is_folder: boolean;
  main_playbook_file?: string;
  file_structure?: FileTreeNode;
  file_count: number;
  total_size_kb: number;
  file_hash: string;
  tags?: Record<string, any>;
  variables?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaybookUploadRequest {
  file: File;
  name: string;
  description?: string;
  tags?: Record<string, any>;
  variables?: Record<string, any>;
}

export interface FolderPlaybookUploadRequest {
  file: File;  // ZIP file
  name: string;
  main_playbook_file: string;
  description?: string;
}

export type PlaybookAction = 'created' | 'updated' | 'deleted' | 'uploaded' | 'replaced';

export interface PlaybookAuditLog {
  id: number;
  playbook_id: number;
  playbook_name: string;
  action: PlaybookAction;
  old_content?: string;
  new_content?: string;
  changes_description?: string;
  ip_address?: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export interface PlaybookAuditLogsResponse {
  playbook_id: number;
  audit_logs: PlaybookAuditLog[];
}

// ===== Job Types =====

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface Job {
  id: number;
  job_id: string;
  parent_job_id?: number;
  is_batch_job: boolean;
  batch_config?: BatchConfig;
  playbook_id: number;
  server_id: number;
  user_id: number;
  status: JobStatus;
  celery_task_id?: string;
  extra_vars?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  child_count?: number;
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

export interface JobCreateRequest {
  playbook_id: number;
  server_id: number;
  extra_vars?: Record<string, any>;
}

// ===== Batch Job Types =====

export type ExecutionStrategy = 'parallel' | 'sequential';

export interface BatchConfig {
  concurrent_limit: number;
  stop_on_failure: boolean;
  execution_strategy: ExecutionStrategy;
  total_servers: number;
  server_ids: number[];
}

export interface BatchJobCreateRequest {
  playbook_id: number;
  server_ids: number[];
  extra_vars?: Record<string, any>;
  concurrent_limit?: number;  // Default: 5
  stop_on_failure?: boolean;  // Default: false
  execution_strategy?: ExecutionStrategy;  // Default: 'parallel'
}

export interface BatchJobResponse {
  id: number;
  job_id: string;
  is_batch_job: boolean;
  batch_config: BatchConfig;
  status: JobStatus;
  playbook_id: number;
  total_servers: number;
  created_at: string;
  message: string;
}

export interface ChildJobsResponse {
  parent_job_id: number;
  total_children: number;
  children: Job[];
}

export interface JobLog {
  id: number;
  line_number: number;
  content: string;
  log_level?: string;
  timestamp: string;
}

export interface JobLogsResponse {
  job_id: number;
  logs: JobLog[];
  total_lines: number;
  returned_lines: number;
}

// ===== Ticket Types =====

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: number;
  ticket_id: string;
  job_id: number;
  created_by: number;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface TicketCreateRequest {
  job_id: number;
  title: string;
  description?: string;
  priority?: TicketPriority;
}

// ===== Pagination Types =====

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ===== API Response Types =====

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

export interface HealthResponse {
  status: string;
  environment: string;
  version: string;
}

export interface JobStatistics {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  success_rate: number;
}

// ===== Filter & Query Types =====

export interface ServerFilters {
  is_active?: boolean;
  environment?: string;
  os_type?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface JobFilters {
  status?: JobStatus;
  playbook_id?: number;
  server_id?: number;
  user_id?: number;
  page?: number;
  per_page?: number;
}

export interface PlaybookFilters {
  is_active?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

// ===== Notification Types =====

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export type NotificationEventType = 
  | 'job_success'
  | 'job_failure'
  | 'batch_complete'
  | 'server_failure'
  | 'high_cpu'
  | 'user_change'
  | 'playbook_update'
  | 'system_alert';

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  severity: NotificationSeverity;
  event_type: NotificationEventType;
  related_entity_type?: string;
  related_entity_id?: number;
  is_read: boolean;
  read_at: string | null;
  channels_sent: string[];
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationPreference {
  id: number;
  user_id: number;
  event_type: NotificationEventType;
  in_app_enabled: boolean;
  email_enabled: boolean;
  browser_push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}

export interface UnreadCountResponse {
  count: number;
}

export interface SSENotificationEvent {
  type: 'connected' | 'notification';
  message?: string;
  data?: Notification;
}
