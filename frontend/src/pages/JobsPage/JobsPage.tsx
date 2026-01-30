/**
 * JobsPage Component
 * Job History & Logs with resource monitoring
 */

import React, { useEffect, useState } from 'react';
import { Search, Filter, ArrowUpDown, RefreshCw, AlertTriangle, X, StopCircle } from 'lucide-react';
import { jobsApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import type { Job } from '../../types';

export const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    loadJobs();
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
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
    return matchesSearch && matchesStatus;
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
                
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">▶</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {job.playbook?.name || 'Unknown Playbook'}
                          </div>
                          <div className="text-xs text-gray-600">
                            #{job.job_id} • by {job.user?.username || 'admin'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-gray-600">📋</span>
                        {job.server ? '1 Node' : '0 Nodes'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span>{new Date(job.started_at || job.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}</span>
                          <span className="text-xs text-gray-600">{formatTime(job.started_at || job.created_at)}</span>
                        </div>
                        <div className="text-xs text-primary-600 mt-1">
                          {getEstimatedFinish(job)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Delete button only for admins on non-cancelled jobs */}
                        {isAdmin && job.status !== 'cancelled' && (
                          <button
                            onClick={(e) => handleStopJob(job, e)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium"
                            title="Delete Job"
                          >
                            <span>🗑️</span>
                            Delete
                          </button>
                        )}
                        
                        {/* Details button - always visible */}
                        <button
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          <span>📄</span>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
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
    </div>
  );
};
