/**
 * JobDetailsPage Component
 * View job details with real-time log streaming
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle, Download, RotateCw } from 'lucide-react';
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

  const handleRerun = async () => {
    if (!job || !confirm('Are you sure you want to re-run this job?')) {
      return;
    }

    try {
      const newJob = await jobsApi.create({
        playbook_id: job.playbook_id,
        server_id: job.server_id,
      });
      addNotification('success', 'Job re-run initiated successfully');
      navigate(`/jobs/${newJob.id}`);
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Failed to re-run job');
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
      WARN: 'text-yellow-400',
      ERROR: 'text-red-400',
      INFO: 'text-blue-400',
    };
    return colors[level as keyof typeof colors] || 'text-gray-400';
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
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              Job #{job.job_id}
              <StatusBadge status={job.status} />
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Playbook: {job.playbook?.name || 'N/A'}</p>
          </div>
        </div>
        <button
          onClick={handleRerun}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RotateCw className="h-4 w-4" />
          Re-run
        </button>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Execution Details */}
        <div className="col-span-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Execution Details</h3>
            
            {/* Started At */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase mb-2">
                <span className="text-gray-400">🕐</span>
                Started At
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {job.started_at 
                  ? new Date(job.started_at).toLocaleDateString('en-US', { 
                      month: '2-digit', 
                      day: '2-digit', 
                      year: 'numeric' 
                    }) + ', ' + new Date(job.started_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })
                  : 'Not started yet'
                }
              </p>
            </div>

            {/* Targets */}
            <div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase mb-2">
                <span className="text-gray-400 dark:text-gray-500">📋</span>
                Targets
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 4].map((num) => (
                  <span
                    key={num}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm font-medium"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Console Output */}
        <div className="col-span-8">
          <div className="bg-gray-900 rounded-lg shadow overflow-hidden">
            {/* Console Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm font-mono">Console Output</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span>{logs.length} lines</span>
              </div>
            </div>

            {/* Console Content */}
            <div className="p-4 h-[600px] overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No logs available yet...
                </div>
              ) : (
                logs.map((log, index) => {
                  const logLevel = getLogLevel(log.content);
                  const levelColor = getLogLevelColor(logLevel);
                  
                  return (
                    <div key={index} className="flex items-start gap-3 mb-1 hover:bg-gray-800 px-2 py-1 rounded">
                      <span className="text-gray-500 text-xs flex-shrink-0 w-24">
                        {new Date(log.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </span>
                      <span className={`${levelColor} font-bold text-xs uppercase flex-shrink-0 w-12`}>
                        {logLevel}
                      </span>
                      <span className="text-gray-300 flex-1 break-words">
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
      </div>
    </div>
  );
};
