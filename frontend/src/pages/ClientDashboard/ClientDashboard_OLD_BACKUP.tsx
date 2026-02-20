/**
 * Client Dashboard Page - Intuitive Surgical
 * Executive compliance dashboard for Network Firmware and OS Patch monitoring
 */

import React, { useEffect, useState } from 'react';
import { Network, Package, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, Clock } from 'lucide-react';
import { jobsApi } from '../../api/api';
import { DynamicChart } from '../../components/DynamicChart/DynamicChart';
import { socketService } from '../../services/socket.service';
import intuitiveLogo from '../../assets/Intuitive_Surgicals.png';

// Dynamic compliance data - supports any status values from CSV last column
interface ComplianceData {
  [statusValue: string]: number;
}

interface ComplianceMetrics {
  compliance: ComplianceData | null;
  totalItems: number;
  compliantCount: number;
  nonCompliantCount: number;
  compliancePercentage: number;
  trend: number; // percentage change from average of last 5 jobs
  trendDirection: 'up' | 'down' | 'stable';
  criticalIssues: number;
  lastJobTime: string;
  jobId: number | null;
}

interface ActivityItem {
  timestamp: string;
  type: 'network' | 'os';
  message: string;
  status: 'success' | 'warning' | 'error';
}

// ⚙️ CONFIGURATION
const COMPLIANCE_CONFIG = {
  networkFirmwareKeywords: ['firmware', 'network device', 'network compliance', 'device compliance'],
  osPatchComplianceKeywords: ['patch', 'os patch', 'operating system patch', 'update'],
  autoRefreshEnabled: false,
  autoRefreshInterval: 60000,
  trendCalculationJobs: 5, // Calculate trend from last 5 successful jobs
};

// Professional color scheme
const COLORS = {
  primary: '#1e3a8a', // Navy Blue
  accent: '#0d9488', // Teal
  success: '#059669', // Medical Green
  warning: '#d97706', // Amber
  critical: '#dc2626', // Red
  purple: '#7c3aed', // Enterprise Purple
  lightBlue: '#3b82f6', // Light Blue
  lightTeal: '#14b8a6', // Light Teal
};

// Helper function to normalize text for flexible matching (handles dashes, spaces, underscores)
const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/[-_\s]+/g, '');
};

export const ClientDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Network Firmware Metrics
  const [networkMetrics, setNetworkMetrics] = useState<ComplianceMetrics>({
    compliance: null,
    totalItems: 0,
    compliantCount: 0,
    nonCompliantCount: 0,
    compliancePercentage: 0,
    trend: 0,
    trendDirection: 'stable',
    criticalIssues: 0,
    lastJobTime: '',
    jobId: null,
  });
  
  // OS Patch Metrics
  const [osMetrics, setOsMetrics] = useState<ComplianceMetrics>({
    compliance: null,
    totalItems: 0,
    compliantCount: 0,
    nonCompliantCount: 0,
    compliancePercentage: 0,
    trend: 0,
    trendDirection: 'stable',
    criticalIssues: 0,
    lastJobTime: '',
    jobId: null,
  });
  
  // Recent Activity
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    loadAllComplianceData();
    
    // Set up WebSocket listener for job completion
    const handleJobComplete = (data: { job_id: string; status: string }) => {
      console.log('[ClientDashboard] Job completed:', data);
      if (data.status === 'success' && COMPLIANCE_CONFIG.autoRefreshEnabled) {
        loadAllComplianceData();
      }
    };
    
    socketService.on('job_complete', handleJobComplete);
    
    // Set up auto-refresh interval if enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (COMPLIANCE_CONFIG.autoRefreshEnabled && COMPLIANCE_CONFIG.autoRefreshInterval > 0) {
      intervalId = setInterval(() => {
        loadAllComplianceData();
      }, COMPLIANCE_CONFIG.autoRefreshInterval);
    }
    
    return () => {
      socketService.off('job_complete', handleJobComplete);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const loadAllComplianceData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadNetworkFirmwareCompliance(),
        loadOSPatchCompliance(),
        loadRecentActivity(),
      ]);
    } catch (error) {
      console.error('[ClientDashboard] Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };
    } finally {
      setLoading(false);
    }
  };

  const loadEnterpriseCompliance = async () => {
    try {
      // Auto-detect playbook by searching for keywords in name
      console.log('[Enterprise] Searching for compliance playbook...');
      
      // Fetch all playbooks
      const playbooksResponse = await jobsApi.list({
        page: 1,
        per_page: 100,
      });
      
      if (!playbooksResponse.items || playbooksResponse.items.length === 0) {
        console.warn('[Enterprise] No jobs found');
        setEnterpriseCompliance({});
        return;
      }
      
      // Find jobs from playbooks matching our keywords
      const keywords = COMPLIANCE_CONFIG.enterpriseComplianceKeywords;
      const matchingJobs = playbooksResponse.items.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        // Must match keywords AND not match firmware/network keywords (to avoid conflicts)
        const matchesEnterprise = keywords.some(keyword => 
          playbookName.includes(normalizeText(keyword))
        );
        const matchesFirmware = COMPLIANCE_CONFIG.networkFirmwareKeywords.some(k => 
          playbookName.includes(normalizeText(k))
        );
        return matchesEnterprise && !matchesFirmware && job.status === 'success';
      });
      
      if (matchingJobs.length === 0) {
        console.warn('[Enterprise] No matching playbook jobs found. Looking for:', keywords);
        setEnterpriseCompliance({});
        return;
      }
      
      // Use the most recent successful job
      const latestJob = matchingJobs[0];
      setEnterpriseJobId(latestJob.id);
      console.log('[Enterprise] Using job:', latestJob.id, '-', latestJob.playbook?.name);
      
      console.log('[Enterprise] Fetching CSV data for job:', latestJob.id);
      const csvData = await jobsApi.getRpmCsv(latestJob.id);
      console.log('[Enterprise] CSV data received:', csvData.total_rows, 'rows');
      console.log('[Enterprise] CSV headers:', csvData.headers);
      
      // Use LAST COLUMN for compliance status
      const lastColumnIndex = csvData.headers.length - 1;
      const lastColumnName = csvData.headers[lastColumnIndex];
      console.log('[Enterprise] Using LAST COLUMN:', lastColumnName, 'at index:', lastColumnIndex);
      
      // Count all unique values in last column dynamically
      const statusCounts: ComplianceData = {};
      csvData.data.forEach((row: string[]) => {
        const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
        statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
      });
      
      console.log('[Enterprise] ✅ Dynamic status counts from last column:', statusCounts);
      console.log('[Enterprise] Unique values found:', Object.keys(statusCounts));
      setEnterpriseCompliance(statusCounts);
    } catch (error) {
      console.error('[Enterprise] ❌ Error loading compliance data:', error);
      setEnterpriseCompliance({});
    }
  };

  const loadFirmwareCompliance = async () => {
    try {
      // Auto-detect playbook by searching for keywords in name
      console.log('[Firmware] Searching for firmware compliance playbook...');
      
      // Fetch all jobs
      const jobsResponse = await jobsApi.list({
        page: 1,
        per_page: 100,
      });
      
      if (!jobsResponse.items || jobsResponse.items.length === 0) {
        console.warn('[Firmware] No jobs found');
        setFirmwareCompliance({});
        return;
      }
      
      // Find jobs from playbooks matching our keywords
      const keywords = COMPLIANCE_CONFIG.networkFirmwareKeywords;
      const matchingJobs = jobsResponse.items.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        return keywords.some(keyword => playbookName.includes(normalizeText(keyword))) && 
               job.status === 'success';
      });
      
      if (matchingJobs.length === 0) {
        console.warn('[Firmware] No matching playbook jobs found. Looking for:', keywords);
        setFirmwareCompliance({});
        return;
      }
      
      // Use the most recent successful job
      const latestJob = matchingJobs[0];
      setFirmwareJobId(latestJob.id);
      console.log('[Firmware] Using job:', latestJob.id, '-', latestJob.playbook?.name);
      
      console.log('[Firmware] Fetching generated files...');
      const filesResponse = await jobsApi.getGeneratedFiles(latestJob.id);
      const files = filesResponse.files || [];
      console.log('[Firmware] Found', files.length, 'files');
      console.log('[Firmware] Files:', files.map((f: any) => f.filename));
      
      // Look for any CSV file with firmware or compliance in name
      const csvFile = files.find(
        (f: any) => f.type === 'csv' && (
          f.filename.toLowerCase().includes('firmware') || 
          f.filename.toLowerCase().includes('compliance')
        )
      );
      
      if (!csvFile) {
        console.warn('[Firmware] ⚠️ No firmware/compliance CSV found');
        console.log('[Firmware] Available files:', files.map((f: any) => ({name: f.filename, type: f.type})));
        setFirmwareCompliance({});
        return;
      }
      
      console.log('[Firmware] Found CSV:', csvFile.filename);
      console.log('[Firmware] Downloading CSV data...');
      const fileContent = await jobsApi.downloadGeneratedFile(
        latestJob.id,
        csvFile.path,
        'view'
      );
      
      console.log('[Firmware] CSV Downloaded. Headers:', fileContent.headers);
      console.log('[Firmware] CSV Data rows:', fileContent.data?.length || 0);
      
      const complianceStatusCounts: Record<string, number> = {};
      
      if (fileContent.headers && fileContent.data) {
        // Use LAST COLUMN for compliance status
        const lastColumnIndex = fileContent.headers.length - 1;
        const lastColumnName = fileContent.headers[lastColumnIndex];
        console.log('[Firmware] Using LAST COLUMN:', lastColumnName, 'at index:', lastColumnIndex);
        
        // Count all unique values in last column dynamically
        fileContent.data.forEach((row: string[]) => {
          const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
          console.log('[Firmware] Row status value:', statusValue);
          complianceStatusCounts[statusValue] = (complianceStatusCounts[statusValue] || 0) + 1;
        });
        
        console.log('[Firmware] ✅ Dynamic status counts from last column:', complianceStatusCounts);
        console.log('[Firmware] Unique values found:', Object.keys(complianceStatusCounts));
      }
      
      // Set firmware compliance data
      console.log('[Firmware] Setting state:', complianceStatusCounts);
      setFirmwareCompliance(complianceStatusCounts);
    } catch (error) {
      console.error('[Firmware] ❌ Error loading compliance data:', error);
      setFirmwareCompliance({});
    }
  };

  const loadFirmwareMatrix = async () => {
    try {
      // Fetch firmware compliance matrix from backend
      const response = await jobsApi.getFirmwareComplianceMatrix();
      setFirmwareMatrix(response.data);
    } catch (error) {
      console.error('Failed to load firmware matrix:', error);
      // Fallback to mock data if API fails
      const mockMatrix: ComplianceItem[] = [
        {
          location: 'Mumbai DC',
          vendors: {
            Cisco: { percentage: 92, status: 'compliant' },
            Fortinet: { percentage: 78, status: 'warning' },
            'Palo Alto': { percentage: 88, status: 'warning' },
            HPE: { percentage: 85, status: 'warning' },
          },
        },
        {
          location: 'BLR DC',
          vendors: {
            Cisco: { percentage: 81, status: 'warning' },
            Fortinet: { percentage: 74, status: 'warning' },
            'Palo Alto': { percentage: 90, status: 'compliant' },
            HPE: { percentage: 72, status: 'warning' },
          },
        },
        {
          location: 'US DC',
          vendors: {
            Cisco: { percentage: 88, status: 'warning' },
            Fortinet: { percentage: 83, status: 'warning' },
            'Palo Alto': { percentage: 79, status: 'warning' },
            HPE: { percentage: 70, status: 'critical' },
          },
        },
      ];
      setFirmwareMatrix(mockMatrix);
    }
  };

  const loadOSPatchCompliance = async () => {
    try {
      // Auto-detect playbook by searching for keywords in name
      console.log('[OS Patch] Searching for OS patch compliance playbook...');
      
      // Fetch all jobs
      const jobsResponse = await jobsApi.list({
        page: 1,
        per_page: 100,
      });
      
      if (!jobsResponse.items || jobsResponse.items.length === 0) {
        console.warn('[OS Patch] No jobs found');
        setOsPatchCompliance({});
        return;
      }
      
      // Find jobs from playbooks matching our keywords
      const keywords = COMPLIANCE_CONFIG.osPatchComplianceKeywords;
      const matchingJobs = jobsResponse.items.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        // Must match keywords AND not match firmware keywords (to avoid conflicts)
        const matchesPatch = keywords.some(keyword => playbookName.includes(normalizeText(keyword)));
        const matchesFirmware = COMPLIANCE_CONFIG.networkFirmwareKeywords.some(k => 
          playbookName.includes(normalizeText(k))
        );
        return matchesPatch && !matchesFirmware && job.status === 'success';
      });
      
      if (matchingJobs.length === 0) {
        console.warn('[OS Patch] No matching playbook jobs found. Looking for:', keywords);
        setOsPatchCompliance({});
        return;
      }
      
      // Use the most recent successful job
      const latestJob = matchingJobs[0];
      setOsPatchJobId(latestJob.id);
      console.log('[OS Patch] Using job:', latestJob.id, '-', latestJob.playbook?.name);
      console.log('[OS Patch] Fetching generated files...');
      
      // Try to get generated files (CSV reports)
      const filesResponse = await jobsApi.getGeneratedFiles(latestJob.id);
      const files = filesResponse?.files || [];
      console.log('[OS Patch] Found', files.length, 'files:', files.map((f: any) => f.filename));
      
      // Look for patch compliance CSV
      const csvFile = files.find((f: any) => 
        f.filename.toLowerCase().includes('patch') && 
        (f.filename.endsWith('.csv') || f.filename.endsWith('.CSV'))
      );
      
      if (!csvFile) {
        console.warn('[OS Patch] No patch compliance CSV found. Trying RPM CSV fallback...');
        // Fallback: Try RPM CSV endpoint
        try {
          const csvData = await jobsApi.getRpmCsv(latestJob.id);
          console.log('[OS Patch] RPM CSV data received:', csvData.total_rows, 'rows');
          console.log('[OS Patch] CSV headers:', csvData.headers);
          
          // Use LAST COLUMN for compliance status
          const lastColumnIndex = csvData.headers.length - 1;
          const lastColumnName = csvData.headers[lastColumnIndex];
          console.log('[OS Patch] Using LAST COLUMN:', lastColumnName, 'at index:', lastColumnIndex);
          
          // Count all unique values in last column dynamically
          const statusCounts: ComplianceData = {};
          csvData.data.forEach((row: string[]) => {
            const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
            statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
          });
          
          console.log('[OS Patch] ✅ Dynamic status counts from last column:', statusCounts);
          console.log('[OS Patch] Unique values found:', Object.keys(statusCounts));
          setOsPatchCompliance(statusCounts);
        } catch (rpmError) {
          console.error('[OS Patch] ❌ RPM CSV also failed:', rpmError);
          setOsPatchCompliance({});
        }
        return;
      }
      
      console.log('[OS Patch] Found CSV:', csvFile.filename);
      console.log('[OS Patch] Downloading CSV data...');
      
      // Download and parse the CSV
      const fileContent = await jobsApi.downloadGeneratedFile(latestJob.id, csvFile.filename);
      console.log('[OS Patch] CSV Downloaded. Headers:', fileContent.headers);
      console.log('[OS Patch] CSV Data rows:', fileContent.data.length);
      
      // Use LAST COLUMN for compliance status
      const lastColumnIndex = fileContent.headers.length - 1;
      const lastColumnName = fileContent.headers[lastColumnIndex];
      console.log('[OS Patch] Using LAST COLUMN:', lastColumnName, 'at index:', lastColumnIndex);
      
      // Count all unique values in last column dynamically
      const statusCounts: ComplianceData = {};
      fileContent.data.forEach((row: string[]) => {
        const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
        statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
      });
      
      console.log('[OS Patch] ✅ Dynamic status counts from last column:', statusCounts);
      console.log('[OS Patch] Unique values found:', Object.keys(statusCounts));
      setOsPatchCompliance(statusCounts);
    } catch (error) {
      console.error('Failed to load OS patch compliance:', error);
      setOsPatchCompliance({});
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllComplianceData();
    setRefreshing(false);
  };

  const calculateCompliancePercentage = (data: ComplianceData | null): number => {
    if (!data || Object.keys(data).length === 0) return 0;
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    // Calculate percentage based on first value as "compliant" (or customize logic as needed)
    const values = Object.values(data);
    return total > 0 && values.length > 0 ? Math.round((values[0] / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading compliance data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Logo */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b-4 border-indigo-600 dark:border-indigo-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Logo Section - Large and Prominent */}
            <div className="flex-shrink-0">
              <img 
                src={intuitiveLogo} 
                alt="Intuitive Surgical" 
                className="h-44 lg:h-52 object-contain"
              />
            </div>
            
            {/* Title and Actions Section */}
            <div className="flex flex-col items-center lg:items-end space-y-4 flex-grow">
              <div className="text-center lg:text-right">
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                  Compliance Dashboard
                </h1>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                  Infrastructure Compliance Monitoring & Analytics
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Enterprise Compliance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Enterprise Compliance
                </h3>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {calculateCompliancePercentage(enterpriseCompliance)}%
            </div>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
              <span>{enterpriseCompliance?.compliant || 0} compliant</span>
              <span className="mx-2">•</span>
              <span>{enterpriseCompliance?.nonCompliant || 0} non-compliant</span>
            </div>
          </div>

          {/* Network Firmware Compliance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Network className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Network Firmware
                </h3>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {firmwareCompliance ? Object.values(firmwareCompliance).reduce((a, b) => a + b, 0) : 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total devices monitored
            </div>
          </div>

          {/* OS Patch Compliance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  OS Patch Compliance
                </h3>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {calculateCompliancePercentage(osPatchCompliance)}%
            </div>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
              {osPatchCompliance && Object.keys(osPatchCompliance).length > 0 ? (
                <span>{Object.entries(osPatchCompliance).map(([key, value]) => `${key}: ${value}`).join(' • ')}</span>
              ) : (
                <span>No data</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Enterprise Compliance */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                Enterprise Compliance Analytics
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Overall compliance status across all enterprise systems
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {enterpriseCompliance && (
                  <>
                    <DynamicChart
                      chartId="enterprise-compliance-pie"
                      initialMetric="compliance-status"
                      initialChartType="pie"
                      initialTimeRange="all"
                      data={{
                        'compliance-status': Object.entries(enterpriseCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                    <DynamicChart
                      chartId="enterprise-compliance-bar"
                      initialMetric="compliance-status"
                      initialChartType="bar"
                      initialTimeRange="all"
                      data={{
                        'compliance-status': Object.entries(enterpriseCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Network Firmware Compliance */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Network className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                Network Firmware Compliance Analytics
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Firmware compliance across network devices by vendor
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Firmware Compliance Matrix */}
              {firmwareMatrix.length > 0 && (
                <ComplianceMatrix
                  title="FIRMWARE COMPLIANCE MATRIX"
                  data={firmwareMatrix}
                  vendors={['Cisco', 'Fortinet', 'Palo Alto', 'HPE']}
                />
              )}
              
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {firmwareCompliance && (
                  <>
                    <DynamicChart
                      chartId="firmware-compliance-pie"
                      initialMetric="network-device-compliance"
                      initialChartType="pie"
                      initialTimeRange="all"
                      data={{
                        'network-device-compliance': Object.entries(firmwareCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                    <DynamicChart
                      chartId="firmware-compliance-bar"
                      initialMetric="network-device-compliance"
                      initialChartType="bar"
                      initialTimeRange="all"
                      data={{
                        'network-device-compliance': Object.entries(firmwareCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: OS Patch Compliance */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Package className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                OS Patch Compliance Analytics
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Operating system patch compliance and update status
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {osPatchCompliance && (
                  <>
                    <DynamicChart
                      chartId="os-patch-compliance-pie"
                      initialMetric="compliance-status"
                      initialChartType="pie"
                      initialTimeRange="all"
                      data={{
                        'compliance-status': Object.entries(osPatchCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                    <DynamicChart
                      chartId="os-patch-compliance-bar"
                      initialMetric="compliance-status"
                      initialChartType="bar"
                      initialTimeRange="all"
                      data={{
                        'compliance-status': Object.entries(osPatchCompliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alert Section */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Action Required
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Some devices require immediate attention. Please review the non-compliant items and schedule maintenance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
