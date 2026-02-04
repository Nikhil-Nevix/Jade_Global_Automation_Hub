/**
 * JobsPage Component
 * Job History & Logs with resource monitoring
 */

import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, AlertTriangle, X, ChevronDown, ChevronRight, Layers, Bug, Trash2, FileText, Server as ServerIcon } from 'lucide-react';
import { jobsApi, serversApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import { getUserTimezone } from '../../utils/timezone';
import type { Job, Server } from '../../types';

export const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [expandedBatchJobs, setExpandedBatchJobs] = useState<Set<number>>(new Set());
  const [childJobsMap, setChildJobsMap] = useState<Record<number, Job[]>>({});
  const [showDebugModal, setShowDebugModal] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    loadJobs();
    loadServers();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await jobsApi.list({ per_page: 100 });
      setJobs(response.items);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      addNotification('error', 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadServers = async () => {
    try {
      const response = await serversApi.list({ per_page: 100 });
      setServers(response.items);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      running: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getCpuUsage = (job: Job) => {
    // Simulate CPU usage - in real app, this would come from backend
    const simulatedUsage = Math.floor(Math.random() * 100);
    return job.status === 'running' ? simulatedUsage : 0;
  };

  const isHighCpuUsage = (cpuUsage: number) => {
    return cpuUsage > 80;
  };

  const handleResourceClick = (job: Job) => {
    const cpuUsage = getCpuUsage(job);
    if (isHighCpuUsage(cpuUsage)) {
      setSelectedJob(job);
      setShowResourceModal(true);
    }
  };

  const handleTerminateProcess = async () => {
    if (!selectedJob) return;
    try {
      await jobsApi.cancel(selectedJob.id);
      addNotification('success', 'Process terminated successfully');
      setShowResourceModal(false);
      loadJobs();
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Failed to terminate process');
    }
  };

  const handleIgnoreAndContinue = () => {
    setShowResourceModal(false);
    addNotification('info', 'Continuing with high resource usage');
  };

  const toggleBatchExpansion = async (jobId: number) => {
    const newExpanded = new Set(expandedBatchJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
      // Load child jobs if not already loaded
      if (!childJobsMap[jobId]) {
        try {
          const response = await jobsApi.getChildJobs(jobId);
          setChildJobsMap(prev => ({ ...prev, [jobId]: response.children }));
        } catch (error) {
          console.error('Failed to load child jobs:', error);
          addNotification('error', 'Failed to load child jobs');
        }
      }
    }
    setExpandedBatchJobs(newExpanded);
  };

  const getBatchJobProgress = (childJobs?: Job[]) => {
    if (!childJobs || childJobs.length === 0) return null;
    const completed = childJobs.filter(j => j.status === 'success').length;
    const failed = childJobs.filter(j => j.status === 'failed').length;
    const running = childJobs.filter(j => j.status === 'running').length;
    const total = childJobs.length;
    return { completed, failed, running, total };
  };

  const handleStopJob = async (job: Job, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    
    if (!window.confirm(`Are you sure you want to stop and delete job #${job.id}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Remove job from UI immediately (optimistic update)
      setJobs(prevJobs => prevJobs.filter(j => j.id !== job.id));
      
      // Then make the API call
      await jobsApi.cancel(job.id);
      addNotification('success', 'Job stopped and removed from history');
    } catch (error: any) {
      // If API call fails, reload jobs to restore correct state
      console.error('Failed to delete job:', error);
      addNotification('error', error.response?.data?.message || 'Failed to stop job');
      loadJobs(); // Reload to restore state
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getUserTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getEstimatedFinish = (job: Job) => {
    if (job.status === 'running') {
      const startTime = new Date(job.started_at || job.created_at);
      const estimatedDuration = 20; // minutes
      const estimatedFinish = new Date(startTime.getTime() + estimatedDuration * 60000);
      return `Est. Finish: ${formatTime(estimatedFinish.toISOString())}`;
    } else if (job.finished_at) {
      const start = new Date(job.started_at || job.created_at);
      const end = new Date(job.finished_at);
      const duration = Math.floor((end.getTime() - start.getTime()) / 60000);
      return `Took ${duration} mins`;
    }
    return '';
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = 
      job.job_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.playbook_name && job.playbook_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || job.status === selectedStatus;
    const matchesServer = selectedServer === 'all' || 
      (job.server && job.server.id === parseInt(selectedServer)) ||
      (job.batch_job_id && job.servers && job.servers.some(s => s.id === parseInt(selectedServer)));
    return matchesSearch && matchesStatus && matchesServer;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Job History & Logs</h2>
        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 transition-colors shadow-glow-sm hover:shadow-glow"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs by ID, playbook, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white text-gray-900 border border-primary-200 shadow-glow rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
          
          {/* Server Filter Dropdown */}
          <div className="relative min-w-[200px]">
            <ServerIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 border border-primary-200 shadow-glow rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
            >
              <option value="all">All Servers</option>
              {servers.map(server => (
                <option key={server.id} value={server.id.toString()}>
                  {server.hostname}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedStatus('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setSelectedStatus('running')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'running'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Running
          </button>
          <button
            onClick={() => setSelectedStatus('success')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Success
          </button>
          <button
            onClick={() => setSelectedStatus('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'failed'
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Failed
          </button>
          <button
            onClick={() => setSelectedStatus('cancelled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === 'cancelled'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Job Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Target Nodes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Timing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-600">
                  No jobs found
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => {
                const cpuUsage = getCpuUsage(job);
                const isHighCpu = isHighCpuUsage(cpuUsage);
                const isExpanded = expandedBatchJobs.has(job.id);
                const childJobs = childJobsMap[job.id];
                const progress = job.is_batch_job ? getBatchJobProgress(childJobs) : null;
                
                return (
                  <React.Fragment key={job.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {job.is_batch_job ? (
                            <button
                              onClick={() => toggleBatchExpansion(job.id)}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="text-gray-600">▶</span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900">
                                {job.playbook?.name || 'Unknown Playbook'}
                              </div>
                              {job.is_batch_job && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                  <Layers className="h-3 w-3" />
                                  Batch
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">
                              #{job.job_id} • by {job.user?.username || 'admin'}
                            </div>
                            {progress && (
                              <div className="text-xs text-gray-500 mt-1">
                                {progress.completed}/{progress.total} completed
                                {progress.failed > 0 && `, ${progress.failed} failed`}
                                {progress.running > 0 && `, ${progress.running} running`}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="text-gray-600">📋</span>
                          {job.is_batch_job 
                            ? `${childJobs?.length || 0} Nodes` 
                            : job.server ? '1 Node' : '0 Nodes'
                          }
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span>{new Intl.DateTimeFormat('en-US', {
                            timeZone: getUserTimezone(),
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }).format(new Date(job.started_at || job.created_at))}</span>
                          <span className="text-xs text-gray-600">{formatTime(job.started_at || job.created_at)}</span>
                        </div>
                        <div className="text-xs text-primary-600 mt-1">
                          {getEstimatedFinish(job)}
                        </div>
                      </div>
                    </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {/* Delete button - available for all jobs */}
                          <button
                            onClick={(e) => handleStopJob(job, e)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                            title="Delete Job"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                          
                          {/* Debug button - only for failed jobs */}
                          {job.status === 'failed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDebugModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-full transition-colors"
                              title="Debug Job"
                            >
                              <Bug className="h-3 w-3" />
                              Debug
                            </button>
                          )}
                          
                          {/* Details button - always visible */}
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-full transition-colors"
                            title="View Details"
                          >
                            <FileText className="h-3 w-3" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Child Jobs - Expandable Section */}
                    {job.is_batch_job && isExpanded && childJobs && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="ml-10 space-y-2">
                            <div className="text-sm font-medium text-gray-700 mb-3">Child Jobs:</div>
                            {childJobs.map((childJob, index) => (
                              <div
                                key={childJob.id}
                                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="text-xs text-gray-500 w-8">#{index + 1}</div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {childJob.server?.hostname || 'Unknown Server'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Job ID: {childJob.job_id}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {childJob.server?.ip_address || 'N/A'}
                                  </div>
                                  <div>{getStatusBadge(childJob.status)}</div>
                                  <button
                                    onClick={() => navigate(`/jobs/${childJob.id}`)}
                                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                                  >
                                    View Logs
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* High Resource Usage Modal */}
      {showResourceModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-xl w-full max-w-md">
            {/* Modal Header */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    High Resource Usage Detected
                  </h3>
                  <p className="text-sm text-gray-600">
                    Server 1 is experiencing critical load.
                  </p>
                </div>
              </div>

              {/* CPU Usage */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                  <span className="text-2xl font-bold text-red-600">{getCpuUsage(selectedJob)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getCpuUsage(selectedJob)}%` }}
                  ></div>
                </div>
              </div>

              {/* Process Info */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                <span className="text-red-600">⚡</span>
                <span className="font-mono">Process: ansible-deploy-app-v2.1</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={handleTerminateProcess}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-error-500 text-white rounded-lg hover:bg-error-600 transition-colors font-medium"
              >
                <X className="h-4 w-4" />
                Terminate Process
              </button>
              <button
                onClick={handleIgnoreAndContinue}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Ignore & Continue
              </button>
            </div>
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
