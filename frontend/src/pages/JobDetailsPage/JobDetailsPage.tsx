/**
 * JobDetailsPage Component
 * View job details with real-time log streaming
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle, Download } from 'lucide-react';
import { jobsApi } from '../../api/api';
import { useUIStore } from '../../store/uiStore';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import type { Job, JobLog } from '../../types';

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (id) {
      loadJobDetails();
    }
  }, [id]);

  useEffect(() => {
    if (!autoRefresh || !job) return;

    // Auto-refresh logs every 2 seconds for running jobs
    if (job.status === 'running' || job.status === 'pending') {
      const interval = setInterval(() => {
        loadLogs();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, job]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const jobData = await jobsApi.get(Number(id));
      setJob(jobData);
      await loadLogs();
    } catch (error: any) {
      console.error('Failed to load job:', error);
      addNotification('error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const logsData = await jobsApi.getLogs(Number(id), 0, 1000);
      setLogs(logsData.logs);

      // Refresh job status
      const jobData = await jobsApi.get(Number(id));
      setJob(jobData);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleCancel = async () => {
    if (!job || !confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    try {
      await jobsApi.cancel(job.id);
      addNotification('success', 'Job cancelled successfully');
      loadJobDetails();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Job not found</div>
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
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Job Details</h2>
            <p className="text-gray-600 mt-1">Job ID: {job.job_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshCw className={`h-4 w-4 inline mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          {(job.status === 'running' || job.status === 'pending') && (
            <button
              onClick={handleCancel}
              className="px-3 py-2 bg-error-600 text-white rounded-md hover:bg-error-700 transition-colors text-sm font-medium"
            >
              <XCircle className="h-4 w-4 inline mr-1" />
              Cancel Job
            </button>
          )}
        </div>
      </div>

      {/* Job info card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <StatusBadge status={job.status} />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Playbook</p>
            <p className="font-medium text-gray-900">{job.playbook?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Server</p>
            <p className="font-medium text-gray-900">{job.server?.hostname || 'N/A'}</p>
            <p className="text-xs text-gray-500">{job.server?.ip_address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Triggered By</p>
            <p className="font-medium text-gray-900">{job.user?.username || 'N/A'}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Created At</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
          {job.started_at && (
            <div>
              <p className="text-sm text-gray-600">Started At</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(job.started_at).toLocaleString()}
              </p>
            </div>
          )}
          {job.completed_at && (
            <div>
              <p className="text-sm text-gray-600">Completed At</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(job.completed_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {job.error_message && (
          <div className="mt-4 p-4 bg-error-50 border border-error-200 rounded-md">
            <p className="text-sm font-medium text-error-700">Error Message</p>
            <p className="text-sm text-error-600 mt-1">{job.error_message}</p>
          </div>
        )}
      </div>

      {/* Logs section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Execution Logs ({logs.length} lines)
          </h3>
          <button
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm overflow-auto max-h-[600px]">
          {logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              {job.status === 'pending'
                ? 'Waiting for job to start...'
                : 'No logs available yet'}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="hover:bg-gray-800 px-2 py-0.5 rounded">
                  <span className="text-gray-500 mr-2">{log.line_number}:</span>
                  <span className="text-gray-300">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="ml-2">{log.content}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
