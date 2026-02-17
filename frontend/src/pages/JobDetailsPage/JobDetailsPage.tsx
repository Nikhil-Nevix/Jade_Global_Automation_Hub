/**
 * JobDetailsPage Component
 * View job details with real-time log streaming via WebSocket
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  RotateCw, 
  X, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Server,
  FileCode,
  Calendar,
  Activity,
  Terminal,
  Bug,
  Download,
  Table,
  Layers,
  FileText,
  Search,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { jobsApi } from '../../api/api';
import { useUIStore } from '../../store/uiStore';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { formatJobDateTime, getUserTimezone } from '../../utils/timezone';
import { webSocketService } from '../../services/websocket';
import type { Job, JobLog } from '../../types';

interface ParsedResult {
  serverName: string;
  address: string;
  data: Record<string, string>;
}

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showConsoleOutput, setShowConsoleOutput] = useState(false);
  const [parsedResults, setParsedResults] = useState<ParsedResult[]>([]);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showPatchReport, setShowPatchReport] = useState(false);
  const [patchReportData, setPatchReportData] = useState<Array<{package: string, oldVersion: string, newVersion: string, status: string}>>([]);
  const [childJobs, setChildJobs] = useState<Job[]>([]);
  const [loadingChildJobs, setLoadingChildJobs] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [rpmCsvData, setRpmCsvData] = useState<{headers: string[], data: string[][]} | null>(null);
  const [showRpmCsv, setShowRpmCsv] = useState(false);
  const [loadingRpmCsv, setLoadingRpmCsv] = useState(false);
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [csvSortConfig, setCsvSortConfig] = useState<{columnIndex: number, direction: 'asc' | 'desc'} | null>(null);
  
  // Generated files state
  const [generatedFiles, setGeneratedFiles] = useState<Array<{
    path: string;
    filename: string;
    size: number;
    size_formatted: string;
    type: string;
    extension: string;
  }>>([]);
  const [showGeneratedFiles, setShowGeneratedFiles] = useState(false);
  const [loadingGeneratedFiles, setLoadingGeneratedFiles] = useState(false);
  const [viewingFile, setViewingFile] = useState<{
    filename: string;
    type: string;
    headers?: string[];
    data?: string[][];
    content?: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadJobDetails();
    }
  }, [id]);

  // WebSocket connection and subscription
  useEffect(() => {
    if (!id || !job) return;

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    // Connect to WebSocket
    webSocketService.connect(token || undefined);
    setWsConnected(webSocketService.isConnected());

    // Subscribe to job logs
    webSocketService.subscribeToJob(Number(id), {
      onLog: (logData) => {
        // Add incoming log to the logs array
        const newLog: JobLog = {
          id: logData.line_number,
          job_id: Number(id),
          line_number: logData.line_number,
          content: logData.content,
          timestamp: logData.timestamp,
          log_level: logData.log_level
        };
        
        setLogs((prevLogs) => {
          // Avoid duplicates by checking line number
          const exists = prevLogs.some(log => log.line_number === newLog.line_number);
          if (exists) return prevLogs;
          return [...prevLogs, newLog];
        });
      },
      onStatus: (statusData) => {
        // Update job status in real-time
        if (statusData.job_id === Number(id)) {
          setJob((prevJob) => prevJob ? {
            ...prevJob,
            status: statusData.status,
            error_message: statusData.error_message || prevJob.error_message
          } : null);
        }
      },
      onSubscribed: (data) => {
        console.log('Subscribed to job logs:', data);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
      }
    });

    // Cleanup on unmount
    return () => {
      webSocketService.unsubscribeFromJob(Number(id));
    };
  }, [id, job?.id]); // Only reconnect when id or job.id changes

  useEffect(() => {
    if (!autoRefresh || !job) return;

    // Fallback polling for non-WebSocket scenarios
    // Only poll if WebSocket is not connected or for batch jobs
    if (!wsConnected || job.is_batch_job) {
      if (job.status === 'running' || job.status === 'pending') {
        const interval = setInterval(() => {
          if (job.is_batch_job) {
            // For batch jobs, refresh child jobs
            loadChildJobs();
          } else {
            // For regular jobs, refresh logs (fallback)
            loadLogs();
          }
        }, 2000);

        return () => clearInterval(interval);
      }
    }
  }, [autoRefresh, job, wsConnected]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Parse results whenever logs change
    if (logs.length > 0) {
      parseConsoleOutput();
    }
  }, [logs]);

  useEffect(() => {
    // Parse patch report when job is loaded
    if (job && job.patch_report) {
      parsePatchReport(job.patch_report);
    }
  }, [job]);

  const parsePatchReport = (csvData: string) => {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length <= 1) return; // Only header or empty

      const parsedData = lines.slice(1).map(line => {
        const [pkg, oldVer, newVer, status] = line.split(',').map(s => s.trim());
        return {
          package: pkg,
          oldVersion: oldVer,
          newVersion: newVer,
          status: status
        };
      });

      setPatchReportData(parsedData);
    } catch (error) {
      console.error('Error parsing patch report:', error);
    }
  };

  const handleDownloadPatchReport = async () => {
    try {
      const response = await jobsApi.downloadPatchReport(Number(id));
      // Create blob from response
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patch_report_${job?.job_id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addNotification('success', 'Patch report downloaded successfully');
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Failed to download patch report');
    }
  };

  const parseConsoleOutput = () => {
    try {
      const fullOutput = logs.map(log => log.content).join('\n');
      const results: ParsedResult[] = [];
      
      // Find all task output sections that contain "msg"
      const msgPattern = /ok:\s*\[([^\]]+)\]\s*=>\s*\{[^}]*"msg":\s*\[(.*?)\]/gs;
      let match;
      
      while ((match = msgPattern.exec(fullOutput)) !== null) {
        const serverName = match[1].trim();
        const msgContent = match[2];
        
        // Parse the msg array content
        const lines = msgContent.split(',').map(line => {
          // Remove quotes and trim
          return line.replace(/["\[\]]/g, '').trim();
        });
        
        const data: Record<string, string> = {};
        let address = '';
        
        lines.forEach(line => {
          // Split by first colon to get key-value pairs
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            data[key] = value;
            
            // Check if this is an IP address field
            if (key.toLowerCase().includes('ipv4') || key.toLowerCase().includes('ip')) {
              address = value;
            }
          }
        });
        
        results.push({
          serverName,
          address: address || 'N/A',
          data
        });
      }
      
      setParsedResults(results);
    } catch (error) {
      console.error('Error parsing console output:', error);
    }
  };

  const loadJobDetails = async () => {
    try {
      console.log('🔍 Loading job details for ID:', id);
      setLoading(true);
      const jobData = await jobsApi.get(Number(id));
      console.log('📊 Job data loaded:', {
        id: jobData.id,
        job_id: jobData.job_id,
        status: jobData.status,
        is_batch_job: jobData.is_batch_job
      });
      setJob(jobData);
      
      // Load child jobs if this is a batch job
      if (jobData.is_batch_job) {
        console.log('📦 Loading child jobs for batch job');
        await loadChildJobs();
      } else {
        // Only load logs for non-batch jobs
        console.log('📝 Loading logs for regular job');
        await loadLogs();
      }
    } catch (error: any) {
      console.error('❌ Failed to load job:', error);
      addNotification('error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const loadChildJobs = async () => {
    try {
      setLoadingChildJobs(true);
      const response = await jobsApi.getChildJobs(Number(id));
      setChildJobs(response.children);
    } catch (error: any) {
      console.error('Failed to load child jobs:', error);
      addNotification('error', 'Failed to load child jobs');
    } finally {
      setLoadingChildJobs(false);
    }
  };

  const loadLogs = async () => {
    try {
      console.log('🔍 Loading logs for job ID:', id);
      const logsData = await jobsApi.getLogs(Number(id), 0, 1000);
      console.log('📊 Logs received:', {
        totalLogs: logsData.logs?.length || 0,
        firstFewLogs: logsData.logs?.slice(0, 3)
      });
      setLogs(logsData.logs);

      // Refresh job status
      const jobData = await jobsApi.get(Number(id));
      setJob(jobData);
      console.log('✅ Logs and job data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load logs:', error);
    }
  };

  const loadRpmCsv = async () => {
    if (!id) return;
    
    setLoadingRpmCsv(true);
    // Reset filters
    setCsvSearchQuery('');
    setCsvSortConfig(null);
    
    try {
      const csvData = await jobsApi.getRpmCsv(Number(id));
      setRpmCsvData({
        headers: csvData.headers,
        data: csvData.data
      });
      setShowRpmCsv(true);
      addNotification('success', 'RPM CSV data loaded successfully');
    } catch (error: any) {
      if (error.response?.status === 404) {
        addNotification('info', 'CSV file not found on server');
      } else {
        addNotification('error', error.response?.data?.message || 'Failed to load CSV data');
      }
    } finally {
      setLoadingRpmCsv(false);
    }
  };

  const loadGeneratedFiles = async () => {
    if (!id) return;
    
    setLoadingGeneratedFiles(true);
    setViewingFile(null); // Reset viewing file
    
    try {
      const response = await jobsApi.getGeneratedFiles(Number(id));
      setGeneratedFiles(response.files);
      setShowGeneratedFiles(true);
      
      if (response.files.length === 0) {
        addNotification('info', 'No report files found for this job');
      } else {
        // Auto-view the first file
        await handleViewFile(response.files[0].path);
      }
    } catch (error: any) {
      addNotification('error', error.response?.data?.message || 'Failed to load report');
    } finally {
      setLoadingGeneratedFiles(false);
    }
  };

  const handleViewFile = async (filePath: string) => {
    try {
      const response = await jobsApi.downloadGeneratedFile(Number(id), filePath, 'view');
      setViewingFile(response);
    } catch (error: any) {
      addNotification('error', error.response?.data?.message || 'Failed to view file');
    }
  };

  const handleDownloadFile = async (filePath: string) => {
    try {
      await jobsApi.downloadGeneratedFile(Number(id), filePath, 'download');
      addNotification('success', 'File downloaded successfully');
    } catch (error: any) {
      addNotification('error', error.response?.data?.message || 'Failed to download file');
    }
  };

  const handleCancel = async () => {
    if (!job || !confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    try {
      await jobsApi.cancel(job.id);
      addNotification('success', 'Job cancelled successfully');
      navigate('/jobs');
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Failed to cancel job');
    }
  };

  const handleDownloadLogs = () => {
    const logText = logs.map((log) => `[${log.timestamp}] ${log.content}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${job?.job_id}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDebug = () => {
    setShowDebugModal(true);
  };

  // CSV Helper Functions
  const isCompliant = (lagValue: string): boolean => {
    // If LAG is "0" or empty → Compliant (Yes)
    // If LAG contains "N-" (N-1, N-2, etc.) → Non-Compliant (No)
    if (!lagValue || lagValue.trim() === '' || lagValue.trim() === '0') return true;
    if (lagValue.toUpperCase().includes('N-')) return false;
    return true;
  };

  const getLagColumnIndex = (): number => {
    if (!rpmCsvData) return -1;
    return rpmCsvData.headers.findIndex(h => h.toUpperCase() === 'LAG');
  };

  const getHostColumnIndex = (): number => {
    if (!rpmCsvData) return -1;
    return rpmCsvData.headers.findIndex(h => h.toUpperCase() === 'HOST');
  };

  const handleCsvSort = (columnIndex: number) => {
    setCsvSortConfig((prevConfig) => {
      if (prevConfig?.columnIndex === columnIndex) {
        // Toggle direction
        return {
          columnIndex,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      // New column, default to ascending
      return { columnIndex, direction: 'asc' };
    });
  };

  const getFilteredAndSortedCsvData = () => {
    if (!rpmCsvData) return [];

    let filteredData = rpmCsvData.data;

    // Apply search filter
    if (csvSearchQuery.trim()) {
      const query = csvSearchQuery.toLowerCase();
      filteredData = filteredData.filter(row =>
        row.some(cell => cell.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (csvSortConfig) {
      filteredData = [...filteredData].sort((a, b) => {
        const aVal = a[csvSortConfig.columnIndex] || '';
        const bVal = b[csvSortConfig.columnIndex] || '';
        
        // Try numeric comparison first
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return csvSortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Fall back to string comparison
        const comparison = aVal.localeCompare(bVal);
        return csvSortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filteredData;
  };

  const handleDownloadCsv = () => {
    if (!rpmCsvData) return;

    const lagColIndex = getLagColumnIndex();
    const hostColIndex = getHostColumnIndex();
    const serverIp = job?.server?.ip_address;

    // Create CSV content with COMPLIANT column and IP address in HOST column
    const csvContent = [
      [...rpmCsvData.headers, 'COMPLIANT'].join(','),
      ...getFilteredAndSortedCsvData().map(row => {
        const lagValue = lagColIndex >= 0 ? row[lagColIndex] : '';
        const compliantValue = isCompliant(lagValue) ? 'Yes' : 'No';
        
        // Replace hostname with IP in HOST column
        const updatedRow = row.map((cell, index) => 
          index === hostColIndex && serverIp ? serverIp : cell
        );
        
        return [...updatedRow, compliantValue].map(cell => `"${cell.replace(/"/g, '""')}"`).join(',');
      })
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rpm_upgrades_with_lag_job_${job?.job_id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addNotification('success', 'CSV downloaded successfully');
  };

  const handleRerun = async () => {
    if (!job || !confirm('Are you sure you want to re-run this job?')) {
      return;
    }

    try {
      // Ensure we have the required IDs
      if (!job.playbook_id || !job.server_id) {
        addNotification('error', 'Cannot re-run job: missing playbook or server information');
        return;
      }

      const payload = {
        playbook_id: job.playbook_id,
        server_id: job.server_id,
        ...(job.extra_vars && { extra_vars: job.extra_vars })
      };

      const newJob = await jobsApi.create(payload);
      addNotification('success', 'Job re-run initiated successfully');
      navigate(`/jobs/${newJob.id}`);
    } catch (error: any) {
      console.error('Re-run error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to re-run job';
      addNotification('error', errorMessage);
    }
  };

  const getLogLevel = (content: string) => {
    if (content.includes('error') || content.includes('ERROR') || content.includes('Fatal')) {
      return 'ERROR';
    } else if (content.includes('warning') || content.includes('WARN')) {
      return 'WARN';
    } else {
      return 'INFO';
    }
  };

  const getLogLevelColor = (level: string) => {
    const colors = {
      WARN: 'text-yellow-600',
      ERROR: 'text-error-600',
      INFO: 'text-primary-600',
    };
    return colors[level as keyof typeof colors] || 'text-gray-600';
  };

  // Calculate duration (only when job has ended)
  const calculateDuration = () => {
    if (!job) return 'N/A';
    
    if (job.started_at && job.completed_at) {
      // Job completed - show final duration (completed_at - started_at)
      const totalSeconds = Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000);
      
      // Format as Min:Sec
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (job.started_at) {
      // Job running - show "In progress"
      return 'In progress';
    }
    
    return 'N/A';
  };

  const getBatchJobProgress = () => {
    if (!childJobs || childJobs.length === 0) return null;
    
    const completed = childJobs.filter(j => j.status === 'success').length;
    const failed = childJobs.filter(j => j.status === 'failed').length;
    const running = childJobs.filter(j => j.status === 'running').length;
    const pending = childJobs.filter(j => j.status === 'pending').length;
    const cancelled = childJobs.filter(j => j.status === 'cancelled').length;
    
    return { completed, failed, running, pending, cancelled, total: childJobs.length };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-700">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-700">Job not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Back to Jobs"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Job Details</h2>
            <p className="text-gray-600 mt-1">Job ID: #{job.job_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Cancel Button */}
          {(job.status === 'pending' || job.status === 'running' || job.status === 'failed') && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 text-white bg-error-500 rounded-lg hover:bg-error-600 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel Job
            </button>
          )}
          {/* Re-run Button - Only for non-batch jobs */}
          {!job.is_batch_job && (
            <button
              onClick={handleRerun}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <RotateCw className="h-4 w-4" />
              Re-run Job
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Status Card */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <div className="mt-2">
                <StatusBadge status={job.status} />
              </div>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Activity className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Playbook Card */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playbook</p>
              <p className="text-lg font-bold text-gray-900 mt-2">{job.playbook?.name || 'N/A'}</p>
            </div>
            <div className="p-3 bg-info-100 rounded-lg">
              <FileCode className="h-6 w-6 text-info-600" />
            </div>
          </div>
        </div>

        {/* Server Card or Batch Info Card */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {job.is_batch_job ? 'Batch Job' : 'Server'}
              </p>
              {job.is_batch_job ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-purple-600" />
                    <span className="text-lg font-bold text-gray-900">
                      {childJobs.length} Servers
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-bold text-gray-900 mt-2">{job.server?.hostname || 'N/A'}</p>
              )}
            </div>
            <div className="p-3 bg-success-100 rounded-lg">
              <Server className="h-6 w-6 text-success-600" />
            </div>
          </div>
        </div>

        {/* Created At Card */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Created</p>
              <p className="text-sm font-semibold text-gray-900 mt-2">
                {formatJobDateTime(job.created_at)}
              </p>
            </div>
            <div className="p-3 bg-warning-100 rounded-lg">
              <Calendar className="h-6 w-6 text-warning-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Execution Timeline */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Timeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Started At */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Started At</span>
            </div>
            <p className="text-sm text-gray-900">
              {job.started_at ? formatJobDateTime(job.started_at) : 'Not started yet'}
            </p>
          </div>

          {/* Ended At */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Ended At</span>
            </div>
            <p className="text-sm text-gray-900">
              {job.completed_at ? formatJobDateTime(job.completed_at) : 'In progress'}
            </p>
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Duration</span>
            </div>
            <p className="text-sm text-gray-900">
              {calculateDuration()}
            </p>
          </div>
        </div>
      </div>

      {/* Batch Job Overview - Child Jobs */}
      {job.is_batch_job && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Child Jobs</h3>
            </div>
            {getBatchJobProgress() && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-success-600 font-medium">
                  ✓ {getBatchJobProgress()?.completed} Completed
                </span>
                {getBatchJobProgress()!.failed > 0 && (
                  <span className="text-error-600 font-medium">
                    ✗ {getBatchJobProgress()?.failed} Failed
                  </span>
                )}
                {getBatchJobProgress()!.running > 0 && (
                  <span className="text-primary-600 font-medium">
                    ⟳ {getBatchJobProgress()?.running} Running
                  </span>
                )}
                {getBatchJobProgress()!.pending > 0 && (
                  <span className="text-warning-600 font-medium">
                    ◷ {getBatchJobProgress()?.pending} Pending
                  </span>
                )}
                <span className="text-gray-600">
                  Total: {getBatchJobProgress()?.total}
                </span>
              </div>
            )}
          </div>

          {loadingChildJobs ? (
            <div className="text-center py-8 text-gray-600">Loading child jobs...</div>
          ) : childJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No child jobs found</div>
          ) : (
            <div className="space-y-3">
              {childJobs.map((childJob, index) => (
                <div
                  key={childJob.id}
                  className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-sm text-gray-500 w-8">#{index + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {childJob.server?.hostname || 'Unknown Server'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {childJob.server?.ip_address || 'N/A'} • Job ID: {childJob.job_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={childJob.status} />
                      <button
                        onClick={() => navigate(`/jobs/${childJob.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-full transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        View Logs
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* View Patch Report Button */}
        {job.patch_report && patchReportData.length > 0 && (
          <>
            <button
              onClick={() => setShowPatchReport(!showPatchReport)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <Table className="h-4 w-4" />
              {showPatchReport ? 'Hide Patch Report' : 'View Patch Report'}
            </button>
            <button
              onClick={handleDownloadPatchReport}
              className="flex items-center gap-2 px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </>
        )}
        {/* View Results Button */}
        {job.status === 'success' && parsedResults.length > 0 && (
          <button
            onClick={() => setShowResults(!showResults)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4" />
            {showResults ? 'Hide Results' : 'View Results'}
          </button>
        )}
        {/* View RPM CSV Button - Only for check.yml playbook */}
        {job.status === 'success' && !job.is_batch_job && job.playbook?.name?.toLowerCase().startsWith('check') && (
          <button
            onClick={loadRpmCsv}
            disabled={loadingRpmCsv}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            {loadingRpmCsv ? 'Loading...' : (showRpmCsv ? 'Reload RPM CSV' : 'View RPM Upgrades')}
          </button>
        )}
        {/* View Report Button - For all successful jobs except check.yml */}
        {job.status === 'success' && !job.is_batch_job && !job.playbook?.name?.toLowerCase().startsWith('check') && (
          <button
            onClick={loadGeneratedFiles}
            disabled={loadingGeneratedFiles}
            className="flex items-center gap-2 px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            {loadingGeneratedFiles ? 'Loading...' : 'View Report'}
          </button>
        )}
        {/* View Console Output Button - Only for non-batch jobs */}
        {!job.is_batch_job && (
          <button
            onClick={() => setShowConsoleOutput(!showConsoleOutput)}
            className="flex items-center gap-2 px-4 py-2 bg-info-500 hover:bg-info-600 text-white rounded-lg transition-colors"
          >
            <Terminal className="h-4 w-4" />
            {showConsoleOutput ? 'Hide Console Output' : 'View Console Output'}
            {showConsoleOutput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        {/* Debug Button - Only for failed jobs */}
        {job.status === 'failed' && (
          <button
            onClick={handleDebug}
            className="flex items-center gap-2 px-4 py-2 bg-warning-500 hover:bg-warning-600 text-white rounded-lg transition-colors"
          >
            <Bug className="h-4 w-4" />
            Debug
          </button>
        )}
      </div>

      {/* Patch Report Table */}
      {showPatchReport && patchReportData.length > 0 && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Patch Installation Report</h3>
            <button
              onClick={handleDownloadPatchReport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Package Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Old Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    New Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patchReportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.package}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {row.oldVersion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {row.newVersion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        row.status === 'Updated' ? 'bg-success-100 text-success-800' :
                        row.status === 'No Change' ? 'bg-gray-100 text-gray-800' :
                        row.status === 'Newly Installed' ? 'bg-info-100 text-info-800' :
                        'bg-error-100 text-error-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            Total packages: {patchReportData.length} | 
            Updated: {patchReportData.filter(p => p.status === 'Updated').length} | 
            No Change: {patchReportData.filter(p => p.status === 'No Change').length} | 
            Newly Installed: {patchReportData.filter(p => p.status === 'Newly Installed').length}
            {patchReportData.filter(p => p.status === 'Failed').length > 0 && ` | Failed: ${patchReportData.filter(p => p.status === 'Failed').length}`}
          </div>
        </div>
      )}

      {/* RPM CSV Table */}
      {showRpmCsv && rpmCsvData && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">RPM Upgrades with Lag</h3>
            </div>
            <button
              onClick={() => {
                setShowRpmCsv(false);
                setCsvSearchQuery('');
                setCsvSortConfig(null);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search and Download Controls */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search in table..."
                value={csvSearchQuery}
                onChange={(e) => setCsvSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {csvSearchQuery && (
                <button
                  onClick={() => setCsvSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>

          {/* Table Container with max height and sticky header */}
          <div className="overflow-x-auto rounded-lg border-2 border-gray-500 max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-500 border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b-2 border-gray-500">
                  {rpmCsvData.headers.map((header, index) => (
                    <th
                      key={index}
                      onClick={() => handleCsvSort(index)}
                      className="px-6 py-4 text-left text-sm font-bold text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none border-r border-gray-500"
                    >
                      <div className="flex items-center gap-2">
                        <span>{header}</span>
                        {csvSortConfig?.columnIndex === index && (
                          csvSortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-4 w-4 text-purple-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-purple-600" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                  {/* COMPLIANT Column */}
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-800 uppercase tracking-wider border-r-0">
                    <div className="flex items-center gap-2">
                      <span>COMPLIANT</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-500">
                {getFilteredAndSortedCsvData().length > 0 ? (
                  getFilteredAndSortedCsvData().map((row, rowIndex) => {
                    const lagColIndex = getLagColumnIndex();
                    const hostColIndex = getHostColumnIndex();
                    const lagValue = lagColIndex >= 0 ? row[lagColIndex] : '';
                    const compliant = isCompliant(lagValue);
                    
                    return (
                      <tr 
                        key={rowIndex} 
                        className={`hover:bg-purple-50 transition-colors border-b border-gray-500 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-6 py-4 text-sm text-gray-900 border-r border-gray-500"
                          >
                            {/* Display IP address for HOST column, otherwise show cell value */}
                            {cellIndex === hostColIndex ? (job?.server?.ip_address || cell) : cell}
                          </td>
                        ))}
                        {/* COMPLIANT Column */}
                        <td className="px-6 py-4 text-sm border-r-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            compliant 
                              ? 'bg-success-100 text-success-800' 
                              : 'bg-error-100 text-error-800'
                          }`}>
                            {compliant ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td 
                      colSpan={rpmCsvData.headers.length + 1}
                      className="px-6 py-8 text-center text-sm text-gray-500 border-0"
                    >
                      {csvSearchQuery ? 'No matching rows found' : 'No data available'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Statistics */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {getFilteredAndSortedCsvData().length} of {rpmCsvData.data.length} rows
              {csvSearchQuery && <span className="ml-2 text-purple-600 font-medium">(filtered)</span>}
            </div>
            {csvSortConfig && (
              <button
                onClick={() => setCsvSortConfig(null)}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Clear sorting
              </button>
            )}
          </div>
        </div>
      )}

      {/* Report Viewer */}
      {showGeneratedFiles && generatedFiles.length > 0 && viewingFile && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          {/* Header with File Selector and Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <FileText className="h-5 w-5 text-success-600" />
              <h3 className="text-lg font-semibold text-gray-900">Report Viewer</h3>
              
              {/* File Selector Dropdown */}
              {generatedFiles.length > 1 && (
                <div className="relative">
                  <select
                    value={generatedFiles.findIndex(f => f.filename === viewingFile.filename)}
                    onChange={(e) => handleViewFile(generatedFiles[Number(e.target.value)].path)}
                    className="pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-primary-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all cursor-pointer"
                  >
                    {generatedFiles.map((file, index) => (
                      <option key={index} value={index}>
                        {file.filename} ({file.size_formatted})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Single file display */}
              {generatedFiles.length === 1 && (
                <span className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg font-medium">
                  {viewingFile.filename}
                </span>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const currentFile = generatedFiles.find(f => f.filename === viewingFile.filename);
                  if (currentFile) handleDownloadFile(currentFile.path);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={() => {
                  setShowGeneratedFiles(false);
                  setViewingFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* File Content Viewer */}
          <div>

            {/* CSV View */}
            {viewingFile.type === 'csv' && viewingFile.headers && viewingFile.data && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      {viewingFile.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingFile.data.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {viewingFile.data.length > 100 && (
                  <div className="px-4 py-3 bg-gray-50 text-xs text-gray-600 text-center border-t border-gray-200">
                    Showing first 100 rows of {viewingFile.data.length}. Download the full file to see all data.
                  </div>
                )}
              </div>
            )}

            {/* Text/JSON View */}
            {viewingFile.type === 'text' && viewingFile.content && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-96 overflow-auto">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                  {viewingFile.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Console Output - Only for non-batch jobs */}
      {!job.is_batch_job && (
        <div className={`transition-all duration-500 ease-in-out ${showConsoleOutput ? 'opacity-100 max-h-[800px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg overflow-hidden">
            {/* Console Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-gray-700" />
                <span className="text-gray-900 font-semibold">Console Output</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin text-primary-500' : ''}`} />
                  <span>{autoRefresh ? 'Live' : 'Paused'}</span>
                </div>
                <span className="text-gray-400">|</span>
                <span>{logs.length} lines</span>
              </div>
            </div>

            {/* Console Content */}
            <div className="p-6 h-[500px] overflow-y-auto font-mono text-sm bg-gray-50 dark:bg-gray-900">
              {logs.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {/* Empty state - no message shown */}
                </div>
              ) : (
                logs.map((log, index) => {
                  const logLevel = getLogLevel(log.content);
                  const levelColor = getLogLevelColor(logLevel);

                  return (
                    <div key={index} className="flex items-start gap-3 mb-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded">
                      <span className="text-gray-600 dark:text-gray-500 text-xs flex-shrink-0 w-20">
                        {new Intl.DateTimeFormat('en-US', {
                          timeZone: getUserTimezone(),
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        }).format(new Date(log.timestamp))}
                      </span>
                      <span className={`${levelColor} font-bold text-xs uppercase flex-shrink-0 w-14`}>
                        {logLevel}
                      </span>
                      <span className="text-gray-900 dark:text-gray-200 flex-1 break-words">
                        {log.content}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Parsed Results Table */}
      {showResults && parsedResults.length > 0 && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Results</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Sr. No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Server Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Address
                  </th>
                  {/* Dynamic columns */}
                  {parsedResults.length > 0 && Object.keys(parsedResults[0].data).map((key) => (
                    <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.serverName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {result.address}
                    </td>
                    {Object.values(result.data).map((value, idx) => (
                      <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debug Modal */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bug className="h-6 w-6 text-warning-600" />
                <h3 className="text-xl font-semibold text-gray-900">Debug Feature</h3>
              </div>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-gray-700 text-center py-8">
                Debug feature coming soon
              </p>
              <p className="text-sm text-gray-500 text-center">
                This feature will help you analyze and troubleshoot failed job executions.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDebugModal(false)}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
