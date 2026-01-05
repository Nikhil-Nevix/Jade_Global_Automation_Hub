/**
 * Dashboard Page
 * Main dashboard with statistics and recent activity
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, FileCode, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { jobsApi, serversApi, playbooksApi } from '../../api/api';
import type { JobStatistics, Job } from '../../types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';

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
      const [jobStats, jobsResponse, serversResponse, playbooksResponse] = await Promise.all([
        jobsApi.getStatistics(),
        jobsApi.list({ page: 1, per_page: 5 }),
        serversApi.list({ page: 1, per_page: 1 }),
        playbooksApi.list({ page: 1, per_page: 1 }),
      ]);

      setStats(jobStats);
      setRecentJobs(jobsResponse.items);
      setServerCount(serversResponse.pagination.total);
      setPlaybookCount(playbooksResponse.pagination.total);
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
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of your infrastructure automation platform</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Servers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Servers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{serverCount}</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playbooks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{playbookCount}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileCode className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <Link to="/playbooks" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            View all playbooks →
          </Link>
        </div>

        {/* Total jobs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <Link to="/jobs" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            View all jobs →
          </Link>
        </div>

        {/* Success rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.success_rate.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-3 bg-success-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {stats?.success || 0} successful jobs
          </p>
        </div>
      </div>

      {/* Job status breakdown */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-2xl font-bold text-gray-700">{stats.pending}</span>
              </div>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-2xl font-bold text-blue-700">{stats.running}</span>
              </div>
              <p className="text-sm text-gray-600">Running</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-success-500 mr-2" />
                <span className="text-2xl font-bold text-success-700">{stats.success}</span>
              </div>
              <p className="text-sm text-gray-600">Success</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <XCircle className="h-5 w-5 text-error-500 mr-2" />
                <span className="text-2xl font-bold text-error-700">{stats.failed}</span>
              </div>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-warning-500 mr-2" />
                <span className="text-2xl font-bold text-warning-700">{stats.cancelled}</span>
              </div>
              <p className="text-sm text-gray-600">Cancelled</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent jobs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Jobs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {job.job_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.playbook?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.server?.hostname || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-primary-600 hover:text-primary-900"
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
