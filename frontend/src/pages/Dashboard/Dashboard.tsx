/**
 * Dashboard Page
 * Main dashboard with statistics and recent activity
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, FileCode, Clock, CheckCircle, XCircle, AlertCircle, Plus, 
  Download, RefreshCw, Calendar, TrendingUp, BarChart3, AlertTriangle
} from 'lucide-react';
import { jobsApi, serversApi, playbooksApi } from '../../api/api';
import { mockApi } from '../../api/mockApi';
import type { JobStatistics, Job, Server as ServerType } from '../../types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { DynamicChart, ChartType, DataMetric } from '../../components/DynamicChart/DynamicChart';
import { getUserTimezone } from '../../utils/timezone';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export type TimeRange = '7days' | '30days' | '3months' | '6months' | '1year' | 'all' | 'custom';

interface ChartConfig {
  id: string;
  metric: DataMetric;
  chartType: ChartType;
  timeRange: TimeRange;
}

interface AnalyticsData {
  successTrends: any;
  executionTimes: any;
  failureAnalysis: any;
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
  const [globalTimeRange, setGlobalTimeRange] = useState<TimeRange>('30days');
  
  // Enhanced analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30days');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadAnalyticsData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadDashboardData();
      loadAnalyticsData();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTimeRange]);

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

  const loadAnalyticsData = async () => {
    if (isDemoMode) return; // Skip analytics in demo mode
    
    try {
      setAnalyticsLoading(true);
      
      const params = {
        time_range: selectedTimeRange,
        ...(selectedTimeRange === 'custom' && customDateRange.start && customDateRange.end
          ? { start_date: customDateRange.start, end_date: customDateRange.end }
          : {}),
      };
      
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

  const handleAnalyticsTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
    if (range !== 'custom') {
      setCustomDateRange({ start: '', end: '' });
      // Reload analytics with new time range
      setTimeout(() => loadAnalyticsData(), 100);
    }
  };

  const handleCustomDateChange = () => {
    if (customDateRange.start && customDateRange.end) {
      loadAnalyticsData();
    }
  };

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

  const handleExportCSV = async () => {
    try {
      setExportingCSV(true);
      const params = {
        format: 'csv' as const,
        time_range: selectedTimeRange,
        ...(selectedTimeRange === 'custom' && customDateRange.start && customDateRange.end
          ? { start_date: customDateRange.start, end_date: customDateRange.end }
          : {}),
      };
      
      const blob = await jobsApi.exportAnalytics(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExportingCSV(false);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
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
      // Filter by completion date (completed_at) or creation date if not completed
      const jobDate = job.completed_at ? new Date(job.completed_at) : new Date(job.created_at);
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

      {/* Advanced Analytics & Insights - Unified Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 border border-primary-200 shadow-glow rounded-lg p-6">
        {/* Analytics Header with Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary-600" />
            <h3 className="text-xl font-semibold text-gray-900">Advanced Analytics & Insights</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Range Filter */}
            {!isDemoMode && (
              <>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <select
                    value={selectedTimeRange}
                    onChange={(e) => handleAnalyticsTimeRangeChange(e.target.value as TimeRange)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="3months">Last 3 months</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Custom Date Range Inputs */}
                {selectedTimeRange === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      onClick={handleCustomDateChange}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Auto Refresh Toggle */}
                <button
                  onClick={toggleAutoRefresh}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                    autoRefresh
                      ? 'bg-success-100 text-success-700 hover:bg-success-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                >
                  <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
                  Auto
                </button>

                {/* Export Buttons */}
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="flex items-center gap-2 px-3 py-2 bg-error-500 text-white rounded-lg hover:bg-error-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  {exportingPDF ? 'Exporting...' : 'PDF'}
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={exportingCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  {exportingCSV ? 'Exporting...' : 'CSV'}
                </button>

                <div className="w-px h-6 bg-gray-300"></div>
              </>
            )}

            {/* Global Time Range Filter for Charts */}
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

        {/* Advanced Analytics Cards - Only shown when NOT in demo mode */}
        {!isDemoMode && (
          <>
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12 mb-6">
                <div className="text-gray-500">Loading analytics data...</div>
              </div>
            ) : analyticsData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Success Rate Trends */}
                <div className="bg-white rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-success-600" />
                    <h4 className="font-semibold text-gray-900">Success Rate Trends</h4>
                  </div>
                  {analyticsData.successTrends?.trends?.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.successTrends.trends.slice(0, 7).map((trend: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600">{trend.period}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-900">{trend.total_jobs} jobs</span>
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

                {/* Average Execution Time */}
                <div className="bg-white rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-info-600" />
                    <h4 className="font-semibold text-gray-900">Avg Execution Time by Playbook</h4>
                  </div>
                  {analyticsData.executionTimes?.playbooks?.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.executionTimes.playbooks.slice(0, 5).map((playbook: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600 truncate max-w-[200px]" title={playbook.playbook_name}>
                            {playbook.playbook_name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{playbook.total_executions} runs</span>
                            <span className="text-sm font-medium text-info-600">
                              {playbook.avg_duration_formatted}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No execution data available</p>
                  )}
                </div>

                {/* Failure Analysis - By Playbook */}
                <div className="bg-white rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-error-600" />
                    <h4 className="font-semibold text-gray-900">Top Failing Playbooks</h4>
                  </div>
                  {analyticsData.failureAnalysis?.by_playbook?.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.failureAnalysis.by_playbook.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600 truncate max-w-[200px]" title={item.playbook_name}>
                            {item.playbook_name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{item.affected_servers} servers</span>
                            <span className="text-sm font-bold text-error-600">
                              {item.failure_count} failures
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-success-600 py-4">No failures in this period! 🎉</p>
                  )}
                </div>

                {/* Failure Analysis - By Server */}
                <div className="bg-white rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Server className="h-5 w-5 text-error-600" />
                    <h4 className="font-semibold text-gray-900">Top Failing Servers</h4>
                  </div>
                  {analyticsData.failureAnalysis?.by_server?.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.failureAnalysis.by_server.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600 truncate max-w-[200px]" title={item.server_hostname}>
                            {item.server_hostname}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{item.affected_playbooks} playbooks</span>
                            <span className="text-sm font-bold text-error-600">
                              {item.failure_count} failures
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-success-600 py-4">No failures in this period! 🎉</p>
                  )}
                </div>

                {/* Failure Summary */}
                {analyticsData.failureAnalysis?.summary && (
                  <div className="lg:col-span-2 bg-gradient-to-r from-error-50 to-warning-50 rounded-lg p-5 border border-error-200">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-5 w-5 text-error-600" />
                      <h4 className="font-semibold text-gray-900">Failure Summary</h4>
                    </div>
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
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 mb-6">
                No analytics data available. Click the refresh button or select a different time range.
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-gray-200 my-6"></div>
          </>
        )}

        {/* Dynamic Charts Section */}
        <div className="space-y-6">
          <h4 className="text-lg font-semibold text-gray-900">Customizable Charts</h4>
          
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
            <div className="bg-white border border-primary-200 rounded-lg p-12 text-center">
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
    </div>
  );
};
