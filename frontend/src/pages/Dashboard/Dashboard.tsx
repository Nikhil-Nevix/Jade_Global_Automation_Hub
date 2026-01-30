/**
 * Dashboard Page
 * Main dashboard with statistics and recent activity
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, FileCode, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react';
import { jobsApi, serversApi, playbooksApi } from '../../api/api';
import { mockApi } from '../../api/mockApi';
import type { JobStatistics, Job, Server as ServerType } from '../../types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { DynamicChart, ChartType, DataMetric } from '../../components/DynamicChart/DynamicChart';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export type TimeRange = '7days' | '30days' | '3months' | '6months' | '1year' | 'all';

interface ChartConfig {
  id: string;
  metric: DataMetric;
  chartType: ChartType;
  timeRange: TimeRange;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<JobStatistics | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [serverCount, setServerCount] = useState(0);
  const [playbookCount, setPlaybookCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<ServerType[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  
  // Chart management state
  const [charts, setCharts] = useState<ChartConfig[]>([
    { id: '1', metric: 'job-status', chartType: 'bar', timeRange: 'all' },
    { id: '2', metric: 'job-success-rate', chartType: 'pie', timeRange: 'all' },
  ]);
  const [globalTimeRange, setGlobalTimeRange] = useState<TimeRange>('all');

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
      
      const [jobStats, jobsResponse, serversResponse, playbooksResponse, allServers, allJobsResponse] = await Promise.all([
        api.jobs.getStatistics(),
        api.jobs.list({ page: 1, per_page: 10 }), // Changed from 5 to 10
        api.servers.list({ page: 1, per_page: 1 }),
        api.playbooks.list({ page: 1, per_page: 1 }),
        api.servers.list({ page: 1, per_page: 100 }), // Fetch more servers for chart data
        api.jobs.list({ page: 1, per_page: 1000 }), // Fetch all jobs for filtering
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

  // Helper function to filter jobs by time range
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
      // Filter by completion date (ended_at) or creation date if not completed
      const jobDate = job.ended_at ? new Date(job.ended_at) : new Date(job.created_at);
      return jobDate >= cutoffDate;
    });
  };

  // Calculate filtered statistics for a specific time range
  const calculateFilteredStats = (jobs: Job[]) => {
    const pending = jobs.filter(j => j.status === 'pending').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const success = jobs.filter(j => j.status === 'success').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const cancelled = jobs.filter(j => j.status === 'cancelled').length;

    return { pending, running, success, failed, cancelled };
  };

  // Prepare chart data based on current state and time range
  const prepareChartData = (timeRange: TimeRange = 'all') => {
    if (!stats) return {};

    // Filter jobs based on time range
    const filteredJobs = filterJobsByTimeRange(allJobs, timeRange);
    const filteredStats = calculateFilteredStats(filteredJobs);

    // Job Status Data
    const jobStatusData = [
      { name: 'Pending', value: filteredStats.pending || 0 },
      { name: 'Running', value: filteredStats.running || 0 },
      { name: 'Success', value: filteredStats.success || 0 },
      { name: 'Failed', value: filteredStats.failed || 0 },
      { name: 'Cancelled', value: filteredStats.cancelled || 0 },
    ];

    // Job Success Rate - now showing all statuses
    const jobSuccessRateData = [
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

    // Server Status
    const activeCount = servers.filter((s) => s.is_active).length;
    const inactiveCount = servers.length - activeCount;
    const serverStatusData = [
      { name: 'Active', value: activeCount },
      { name: 'Inactive', value: inactiveCount },
    ];

    // Server Environment
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
      'job-success-rate': jobSuccessRateData,
      'server-os-distribution': serverOsData,
      'server-status': serverStatusData,
      'server-environment': serverEnvironmentData,
    };
  };

  // Chart management functions
  const handleAddChart = () => {
    const newChart: ChartConfig = {
      id: Date.now().toString(),
      metric: 'job-status',
      chartType: 'bar',
      timeRange: 'all',
    };
    setCharts([...charts, newChart]);
  };

  const handleRemoveChart = (id: string) => {
    setCharts(charts.filter((chart) => chart.id !== id));
  };

  const handleMetricChange = (id: string, metric: DataMetric) => {
    setCharts(charts.map((chart) => (chart.id === id ? { ...chart, metric } : chart)));
  };

  const handleChartTypeChange = (id: string, chartType: ChartType) => {
    setCharts(charts.map((chart) => (chart.id === id ? { ...chart, chartType } : chart)));
  };

  const handleTimeRangeChange = (id: string, timeRange: TimeRange) => {
    setCharts(charts.map((chart) => (chart.id === id ? { ...chart, timeRange } : chart)));
  };

  const handleApplyToAllCharts = () => {
    setCharts(charts.map((chart) => ({ ...chart, timeRange: globalTimeRange })));
  };

  const chartData = prepareChartData();

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
        <p className="text-gray-600 mt-1">Overview of your infrastructure automation platform</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Servers */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6 transition-all hover:shadow-glow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Servers</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{serverCount}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Server className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <Link to="/servers" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block font-medium">
            View all servers →
          </Link>
        </div>

        {/* Playbooks */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6 transition-all hover:shadow-glow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playbooks</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{playbookCount}</p>
            </div>
            <div className="p-3 bg-info-100 rounded-lg">
              <FileCode className="h-6 w-6 text-info-600" />
            </div>
          </div>
          <Link to="/playbooks" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block font-medium">
            View all playbooks →
          </Link>
        </div>

        {/* Total jobs */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6 transition-all hover:shadow-glow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats?.total || 0}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Clock className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            {stats?.running || 0} currently running
          </p>
        </div>

        {/* Success rate */}
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6 transition-all hover:shadow-glow-lg">
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
          <p className="text-sm text-gray-600 mt-4">
            {stats?.success || 0} successful jobs
          </p>
        </div>
      </div>

      {/* Job status breakdown */}
      {stats && (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Status Overview</h3>
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
                <Clock className="h-5 w-5 text-info-500 mr-2" />
                <span className="text-2xl font-bold text-info-700">{stats.running}</span>
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

      {/* Analytics Charts Section */}
      <div className="space-y-6">
        {/* Section Header with Time Range Filter and Add Chart Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics & Insights</h2>
          <div className="flex items-center gap-3">
            {/* Global Time Range Filter */}
            <select
              value={globalTimeRange}
              onChange={(e) => setGlobalTimeRange(e.target.value as TimeRange)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="1year">Last year</option>
              <option value="all">All time</option>
            </select>
            
            {/* Apply to All Charts Button */}
            <button
              onClick={handleApplyToAllCharts}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              title="Apply selected time range to all charts"
            >
              Apply to All
            </button>
            
            {/* Add Chart Button */}
            <button
              onClick={handleAddChart}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Chart
            </button>
          </div>
        </div>

        {/* Charts Grid */}
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

        {charts.length === 0 && (
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 mb-4">No charts added yet</p>
            <button
              onClick={handleAddChart}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Your First Chart
            </button>
          </div>
        )}
      </div>

      {/* Recent jobs */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Jobs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
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
                      {new Date(job.created_at).toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
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
    </div>
  );
};
