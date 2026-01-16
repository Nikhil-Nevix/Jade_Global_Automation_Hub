/**
 * Dashboard Page
 * Main dashboard with statistics and recent activity
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, FileCode, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { jobsApi, serversApi, playbooksApi } from '../../api/api';
import { mockApi } from '../../api/mockApi';
import type { JobStatistics, Job } from '../../types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<JobStatistics | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [serverCount, setServerCount] = useState(0);
  const [playbookCount, setPlaybookCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const api = isDemoMode ? mockApi : {
        jobs: jobsApi,
        servers: serversApi,
        playbooks: playbooksApi,
      };
      
      const [jobStats, jobsResponse, serversResponse, playbooksResponse] = await Promise.all([
        api.jobs.getStatistics(),
        api.jobs.list({ page: 1, per_page: 10 }), // Changed from 5 to 10
        api.servers.list({ page: 1, per_page: 1 }),
        api.playbooks.list({ page: 1, per_page: 1 }),
      ]);

      setStats(jobStats);
      setRecentJobs(jobsResponse.items);
      setServerCount(serversResponse.total);
      setPlaybookCount(playbooksResponse.total);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your infrastructure automation platform</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Servers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Servers</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{serverCount}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Server className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <Link to="/servers" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            View all servers →
          </Link>
        </div>

        {/* Playbooks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Playbooks</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{playbookCount}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileCode className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
          </div>
          <Link to="/playbooks" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-4 inline-block">
            View all playbooks →
          </Link>
        </div>

        {/* Total jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats?.total || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-300" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            {stats?.running || 0} currently running
          </p>
        </div>

        {/* Success rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats?.success_rate.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            {stats?.success || 0} successful jobs
          </p>
        </div>
      </div>

      {/* Job status breakdown */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.pending}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.running}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Running</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
                <span className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.success}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Success</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
                <span className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.failed}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mr-2" />
                <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.cancelled}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cancelled</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent jobs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Jobs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No jobs found
                  </td>
                </tr>
              ) : (
                recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {job.job_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.playbook?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.server?.hostname || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300"
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
    </div>
  );
};
