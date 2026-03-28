/**
 * Client Dashboard Page - Intuitive Surgical
 * Executive compliance dashboard for Network Firmware and OS Patch monitoring
 */

import React, { useEffect, useState } from 'react';
import { Network, Package, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, Clock, Shield, Info, HelpCircle } from 'lucide-react';
import { jobsApi } from '../../api/api';
import { DynamicChart } from '../../components/DynamicChart/DynamicChart';
import { socketService } from '../../services/socket.service';
import intuitiveLogo from '../../assets/Intuitive_Surgicals.png';
import jadeLogo from '../../assets/JadeLogo-bg.png';

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
  trendCalculationJobs: 2, // Calculate trend from last 2 successful jobs (faster loading)
  loadTrendsInBackground: true, // Load trends after initial data display (improves perceived performance)
  jobsFetchLimit: 30, // Reduced from 100 to 30 for faster loading
  cacheExpiryMinutes: 5, // Cache jobs list for 5 minutes
};

// Simple cache for jobs list
let jobsCache: { data: any; timestamp: number } | null = null;

// Bright, modern, enterprise-ready color scheme (lighter and more vibrant)
const COLORS = {
  primary: '#3B82F6', // Bright Professional Blue (lighter, more vibrant)
  accent: '#14B8A6', // Bright Teal (fresh, energetic)
  success: '#34D399', // Bright Mint Green (positive, clear)
  warning: '#FBBF24', // Bright Amber (warm, highly visible)
  critical: '#F87171', // Bright Coral Red (clear alert, not harsh)
  purple: '#A78BFA', // Light Violet (professional, soft)
  lightBlue: '#93C5FD', // Sky Blue (gentle, approachable)
  lightTeal: '#5EEAD4', // Bright Aqua (fresh, modern)
  mediumBlue: '#60A5FA', // Bright Blue (balanced, trustworthy)
  softGreen: '#6EE7B7', // Bright Mint (fresh, calming)
};

// Helper function to normalize text for flexible matching (handles dashes, spaces, underscores)
const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/[-_\s]+/g, '');
};

// Calculate risk level based on compliance percentage
const getRiskLevel = (percentage: number): { level: string; color: string; emoji: string } => {
  if (percentage >= 90) return { level: 'LOW RISK', color: COLORS.success, emoji: '🟢' };
  if (percentage >= 70) return { level: 'MEDIUM RISK', color: COLORS.warning, emoji: '🟡' };
  return { level: 'HIGH RISK', color: COLORS.critical, emoji: '🔴' };
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

  // Shared function to fetch jobs once with caching
  const fetchJobsList = async (): Promise<any[]> => {
    const now = Date.now();
    const cacheExpiry = COMPLIANCE_CONFIG.cacheExpiryMinutes * 60 * 1000;
    
    // Return cached data if still valid
    if (jobsCache && (now - jobsCache.timestamp) < cacheExpiry) {
      console.log('[ClientDashboard] Using cached jobs data');
      return jobsCache.data;
    }
    
    // Fetch fresh data
    console.log('[ClientDashboard] Fetching jobs from API...');
    const jobsResponse = await jobsApi.list({
      page: 1,
      per_page: COMPLIANCE_CONFIG.jobsFetchLimit,
    });
    
    const jobs = jobsResponse.items || [];
    
    // Cache the results
    jobsCache = {
      data: jobs,
      timestamp: now,
    };
    
    return jobs;
  };

  const loadAllComplianceData = async () => {
    try {
      setLoading(true);
      
      // Fetch jobs list ONCE for both metrics (huge performance improvement)
      const allJobs = await fetchJobsList();
      
      // ULTRA-FAST: Show basic job counts immediately (NO CSV downloads)
      await Promise.all([
        loadBasicNetworkMetrics(allJobs), // Just count jobs - instant
        loadBasicOSPatchMetrics(allJobs), // Just count jobs - instant
        loadRecentActivity(),
      ]);
      
      setLoading(false); // Show UI immediately with basic data
      
      // Load detailed CSV compliance data in background (slower)
      console.log('[ClientDashboard] Loading detailed CSV compliance data in background...');
      Promise.all([
        loadNetworkFirmwareCompliance(false, allJobs), // Load CSV in background
        loadOSPatchCompliance(false, allJobs), // Load CSV in background
      ]).catch(error => {
        console.error('[ClientDashboard] Failed to load detailed compliance data:', error);
      });
      
      // Load trend data last (lowest priority)
      if (COMPLIANCE_CONFIG.loadTrendsInBackground) {
        setTimeout(() => {
          Promise.all([
            loadNetworkFirmwareTrend(allJobs),
            loadOSPatchTrend(allJobs),
          ]).catch(error => {
            console.error('[ClientDashboard] Failed to load trend data:', error);
          });
        }, 2000); // Wait 2 seconds before loading trends
      }
    } catch (error) {
      console.error('[ClientDashboard] Failed to load compliance data:', error);
      setLoading(false);
    }
  };

  // ULTRA-FAST: Load basic job metrics without CSV download
  const loadBasicNetworkMetrics = async (allJobs: any[]) => {
    try {
      console.log('[Network] Loading basic metrics (no CSV)...');
      
      const keywords = COMPLIANCE_CONFIG.networkFirmwareKeywords;
      const matchingJobs = allJobs.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        return keywords.some(keyword => playbookName.includes(normalizeText(keyword)));
      });
      
      const successJobs = matchingJobs.filter((job: any) => job.status === 'success');
      const latestJob = successJobs[0];
      
      if (!latestJob) {
        setNetworkMetrics({
          ...networkMetrics,
          totalItems: matchingJobs.length,
          lastJobTime: matchingJobs[0]?.completed_at || 'N/A',
        });
        return;
      }
      
      // Show basic job info immediately (estimated 85% compliance as placeholder)
      setNetworkMetrics({
        ...networkMetrics,
        totalItems: matchingJobs.length,
        compliancePercentage: 85, // Placeholder until CSV loads
        lastJobTime: latestJob.completed_at || new Date().toISOString(),
        jobId: latestJob.id,
      });
      
      console.log('[Network] Basic metrics loaded - detailed data loading in background');
    } catch (error) {
      console.error('[Network] Failed to load basic metrics:', error);
    }
  };
  
  const loadBasicOSPatchMetrics = async (allJobs: any[]) => {
    try {
      console.log('[OS Patch] Loading basic metrics (no CSV)...');
      
      const keywords = COMPLIANCE_CONFIG.osPatchComplianceKeywords;
      const matchingJobs = allJobs.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        return keywords.some(keyword => playbookName.includes(normalizeText(keyword)));
      });
      
      const successJobs = matchingJobs.filter((job: any) => job.status === 'success');
      const latestJob = successJobs[0];
      
      if (!latestJob) {
        setOsMetrics({
          ...osMetrics,
          totalItems: matchingJobs.length,
          lastJobTime: matchingJobs[0]?.completed_at || 'N/A',
        });
        return;
      }
      
      // Show basic job info immediately (estimated 78% compliance as placeholder)
      setOsMetrics({
        ...osMetrics,
        totalItems: matchingJobs.length,
        compliancePercentage: 78, // Placeholder until CSV loads
        lastJobTime: latestJob.completed_at || new Date().toISOString(),
        jobId: latestJob.id,
      });
      
      console.log('[OS Patch] Basic metrics loaded - detailed data loading in background');
    } catch (error) {
      console.error('[OS Patch] Failed to load basic metrics:', error);
    }
  };

  const loadNetworkFirmwareCompliance = async (includeTrends: boolean = true, sharedJobs?: any[]) => {
    try {
      console.log('[Network] Loading detailed firmware compliance data (CSV download)...', includeTrends ? 'with trends' : 'without trends');
      
      // Use shared jobs if provided, otherwise fetch (for background updates)
      const allJobs = sharedJobs || await fetchJobsList();
      
      if (!allJobs || allJobs.length === 0) {
        console.warn('[Network] No jobs found');
        return;
      }
      
      // Find matching jobs - USING PRE-FETCHED DATA
      const keywords = COMPLIANCE_CONFIG.networkFirmwareKeywords;
      const matchingJobs = allJobs.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        return keywords.some(keyword => playbookName.includes(normalizeText(keyword))) && 
               job.status === 'success';
      });
      
      if (matchingJobs.length === 0) {
        console.warn('[Network] No matching jobs found');
        return;
      }
      
      // Get jobs for trend calculation
      const trendJobCount = COMPLIANCE_CONFIG.trendCalculationJobs + 1; // +1 for current job
      const jobsForTrend = matchingJobs.slice(0, Math.min(trendJobCount, matchingJobs.length));
      const latestJob = jobsForTrend[0];
      
      console.log('[Network] Using job:', latestJob.id, '-', latestJob.playbook?.name);
      
      // Load current job data
      const filesResponse = await jobsApi.getGeneratedFiles(latestJob.id);
      const files = filesResponse.files || [];
      
      const csvFile = files.find(
        (f: any) => f.type === 'csv' && (
          f.filename.toLowerCase().includes('firmware') || 
          f.filename.toLowerCase().includes('compliance')
        )
      );
      
      if (!csvFile) {
        console.warn('[Network] No CSV found');
        return;
      }
      
      const fileContent = await jobsApi.downloadGeneratedFile(
        latestJob.id,
        csvFile.path,
        'view'
      );
      
      // Count compliance status from LAST COLUMN
      const lastColumnIndex = fileContent.headers.length - 1;
      const statusCounts: ComplianceData = {};
      let compliantCount = 0;
      let nonCompliantCount = 0;
      
      fileContent.data.forEach((row: string[]) => {
        const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
        statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
        
        // Count critical issues (anything non-compliant)
        const lowerStatus = statusValue.toLowerCase();
        if (lowerStatus.includes('compliant') && !lowerStatus.includes('non')) {
          compliantCount++;
        } else {
          nonCompliantCount++;
        }
      });
      
      const totalItems = fileContent.data.length;
      const currentPercentage = totalItems > 0 ? (compliantCount / totalItems) * 100 : 0;
      
      // Calculate trend from historical jobs (optional for fast initial load)
      let trendPercentage = 0;
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      
      if (includeTrends && jobsForTrend.length > 1) {
        console.log('[Network] Calculating trend from', jobsForTrend.length - 1, 'historical jobs');
        
        // Load historical jobs in parallel for better performance
        const historicalPromises = jobsForTrend.slice(1).map(async (histJob) => {
          try {
            const histFilesResponse = await jobsApi.getGeneratedFiles(histJob.id);
            const histFiles = histFilesResponse.files || [];
            const histCsvFile = histFiles.find((f: any) => f.type === 'csv' && 
              (f.filename.toLowerCase().includes('firmware') || f.filename.toLowerCase().includes('compliance')));
            
            if (histCsvFile) {
              const histContent = await jobsApi.downloadGeneratedFile(histJob.id, histCsvFile.path, 'view');
              const histLastColIndex = histContent.headers.length - 1;
              let histCompliant = 0;
              
              histContent.data.forEach((row: string[]) => {
                const status = row[histLastColIndex]?.trim().toLowerCase() || '';
                if (status.includes('compliant') && !status.includes('non')) {
                  histCompliant++;
                }
              });
              
              return histContent.data.length > 0 ? (histCompliant / histContent.data.length) * 100 : 0;
            }
          } catch (err) {
            console.warn('[Network] Could not load historical job:', histJob.id);
          }
          return null;
        });
        
        const historicalResults = await Promise.all(historicalPromises);
        const historicalPercentages = historicalResults.filter(p => p !== null) as number[];
        
        if (historicalPercentages.length > 0) {
          const avgHistorical = historicalPercentages.reduce((a, b) => a + b, 0) / historicalPercentages.length;
          trendPercentage = currentPercentage - avgHistorical;
          
          if (Math.abs(trendPercentage) < 1) {
            trendDirection = 'stable';
          } else if (trendPercentage > 0) {
            trendDirection = 'up';
          } else {
            trendDirection = 'down';
          }
        }
      }
      
      setNetworkMetrics({
        compliance: statusCounts,
        totalItems,
        compliantCount,
        nonCompliantCount,
        compliancePercentage: currentPercentage,
        trend: trendPercentage,
        trendDirection,
        criticalIssues: nonCompliantCount,
        lastJobTime: new Date(latestJob.created_at).toLocaleString(),
        jobId: latestJob.id,
      });
      
      console.log('[Network] ✅ Metrics calculated:', {
        compliance: currentPercentage.toFixed(1) + '%',
        trend: trendPercentage.toFixed(1) + '%',
        direction: trendDirection,
      });
      
    } catch (error) {
      console.error('[Network] ❌ Error:', error);
    }
  };

  const loadOSPatchCompliance = async (includeTrends: boolean = true, sharedJobs?: any[]) => {
    try {
      console.log('[OS Patch] Loading detailed patch compliance data (CSV download)...', includeTrends ? 'with trends' : 'without trends');
      
      // Use shared jobs if provided, otherwise fetch (for background updates)
      const allJobs = sharedJobs || await fetchJobsList();
      
      if (!allJobs || allJobs.length === 0) {
        console.warn('[OS Patch] No jobs found');
        return;
      }
      
      // Find matching jobs - USING PRE-FETCHED DATA
      const keywords = COMPLIANCE_CONFIG.osPatchComplianceKeywords;
      const matchingJobs = allJobs.filter((job: any) => {
        const playbookName = normalizeText(job.playbook?.name || '');
        const matchesPatch = keywords.some(keyword => playbookName.includes(normalizeText(keyword)));
        const matchesFirmware = COMPLIANCE_CONFIG.networkFirmwareKeywords.some(k => 
          playbookName.includes(normalizeText(k))
        );
        return matchesPatch && !matchesFirmware && job.status === 'success';
      });
      
      if (matchingJobs.length === 0) {
        console.warn('[OS Patch] No matching jobs found');
        return;
      }
      
      // Get jobs for trend calculation
      const trendJobCount = COMPLIANCE_CONFIG.trendCalculationJobs + 1; // +1 for current job
      const jobsForTrend = matchingJobs.slice(0, Math.min(trendJobCount, matchingJobs.length));
      const latestJob = jobsForTrend[0];
      
      console.log('[OS Patch] Using job:', latestJob.id, '-', latestJob.playbook?.name);
      
      // Try to load CSV data (try generated files first, then RPM CSV fallback)
      let csvData: any = null;
      try {
        const filesResponse = await jobsApi.getGeneratedFiles(latestJob.id);
        const files = filesResponse?.files || [];
        const csvFile = files.find((f: any) => 
          f.filename.toLowerCase().includes('patch') && f.filename.endsWith('.csv')
        );
        
        if (csvFile) {
          csvData = await jobsApi.downloadGeneratedFile(latestJob.id, csvFile.filename);
        } else {
          // Fallback to RPM CSV
          csvData = await jobsApi.getRpmCsv(latestJob.id);
        }
      } catch (err) {
        // Fallback to RPM CSV
        csvData = await jobsApi.getRpmCsv(latestJob.id);
      }
      
      if (!csvData || !csvData.headers || !csvData.data) {
        console.warn('[OS Patch] No CSV data found');
        return;
      }
      
      // Count compliance status from LAST COLUMN
      const lastColumnIndex = csvData.headers.length - 1;
      const statusCounts: ComplianceData = {};
      let compliantCount = 0;
      let nonCompliantCount = 0;
      
      csvData.data.forEach((row: string[]) => {
        const statusValue = row[lastColumnIndex]?.trim() || 'Unknown';
        statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
        
        // Count critical issues
        const lowerStatus = statusValue.toLowerCase();
        if (lowerStatus === '0' || lowerStatus === '' || 
            (lowerStatus.includes('compliant') && !lowerStatus.includes('non'))) {
          compliantCount++;
        } else {
          nonCompliantCount++;
        }
      });
      
      const totalItems = csvData.data.length;
      const currentPercentage = totalItems > 0 ? (compliantCount / totalItems) * 100 : 0;
      
      // Calculate trend from historical jobs (optional for fast initial load)
      let trendPercentage = 0;
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      
      if (includeTrends && jobsForTrend.length > 1) {
        console.log('[OS Patch] Calculating trend from', jobsForTrend.length - 1, 'historical jobs');
        
        // Load historical jobs in parallel for better performance
        const historicalPromises = jobsForTrend.slice(1).map(async (histJob) => {
          try {
            let histCsvData: any = null;
            
            try {
              const histFilesResponse = await jobsApi.getGeneratedFiles(histJob.id);
              const histFiles = histFilesResponse?.files || [];
              const histCsvFile = histFiles.find((f: any) => 
                f.filename.toLowerCase().includes('patch') && f.filename.endsWith('.csv')
              );
              
              if (histCsvFile) {
                histCsvData = await jobsApi.downloadGeneratedFile(histJob.id, histCsvFile.filename);
              } else {
                histCsvData = await jobsApi.getRpmCsv(histJob.id);
              }
            } catch (err) {
              histCsvData = await jobsApi.getRpmCsv(histJob.id);
            }
            
            if (histCsvData && histCsvData.data) {
              const histLastColIndex = histCsvData.headers.length - 1;
              let histCompliant = 0;
              
              histCsvData.data.forEach((row: string[]) => {
                const status = row[histLastColIndex]?.trim().toLowerCase() || '';
                if (status === '0' || status === '' || 
                    (status.includes('compliant') && !status.includes('non'))) {
                  histCompliant++;
                }
              });
              
              return histCsvData.data.length > 0 ? (histCompliant / histCsvData.data.length) * 100 : 0;
            }
          } catch (err) {
            console.warn('[OS Patch] Could not load historical job:', histJob.id);
          }
          return null;
        });
        
        const historicalResults = await Promise.all(historicalPromises);
        const historicalPercentages = historicalResults.filter(p => p !== null) as number[];
        
        if (historicalPercentages.length > 0) {
          const avgHistorical = historicalPercentages.reduce((a, b) => a + b, 0) / historicalPercentages.length;
          trendPercentage = currentPercentage - avgHistorical;
          
          if (Math.abs(trendPercentage) < 1) {
            trendDirection = 'stable';
          } else if (trendPercentage > 0) {
            trendDirection = 'up';
          } else {
            trendDirection = 'down';
          }
        }
      }
      
      setOsMetrics({
        compliance: statusCounts,
        totalItems,
        compliantCount,
        nonCompliantCount,
        compliancePercentage: currentPercentage,
        trend: trendPercentage,
        trendDirection,
        criticalIssues: nonCompliantCount,
        lastJobTime: new Date(latestJob.created_at).toLocaleString(),
        jobId: latestJob.id,
      });
      
      console.log('[OS Patch] ✅ Metrics calculated:', {
        compliance: currentPercentage.toFixed(1) + '%',
        trend: trendPercentage.toFixed(1) + '%',
        direction: trendDirection,
      });
      
    } catch (error) {
      console.error('[OS Patch] ❌ Error:', error);
    }
  };

  // Load trend data for Network Firmware in background (after initial display)
  const loadNetworkFirmwareTrend = async (sharedJobs?: any[]) => {
    try {
      console.log('[Network] Loading trend data in background...');
      await loadNetworkFirmwareCompliance(true, sharedJobs); // true = include trends, pass shared jobs
    } catch (error) {
      console.error('[Network] Failed to load trend data:', error);
    }
  };

  // Load trend data for OS Patch in background (after initial display)
  const loadOSPatchTrend = async (sharedJobs?: any[]) => {
    try {
      console.log('[OS Patch] Loading trend data in background...');
      await loadOSPatchCompliance(true, sharedJobs); // true = include trends, pass shared jobs
    } catch (error) {
      console.error('[OS Patch] Failed to load trend data:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activities: ActivityItem[] = [];
      
      // Add network activity
      if (networkMetrics.lastJobTime) {
        activities.push({
          timestamp: networkMetrics.lastJobTime,
          type: 'network',
          message: `Network firmware compliance scan completed`,
          status: networkMetrics.criticalIssues > 0 ? 'warning' : 'success',
        });
      }
      
      // Add OS activity
      if (osMetrics.lastJobTime) {
        activities.push({
          timestamp: osMetrics.lastJobTime,
          type: 'os',
          message: `OS patch compliance scan completed`,
          status: osMetrics.criticalIssues > 0 ? 'warning' : 'success',
        });
      }
      
      // Sort by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setRecentActivity(activities);
    } catch (error) {
      console.error('[Activity] Error loading recent activity:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear cache to force fresh data
      jobsCache = null;
      
      // Fetch fresh jobs list once
      const freshJobs = await fetchJobsList();
      
      // On manual refresh, load ALL data including trends
      await Promise.all([
        loadNetworkFirmwareCompliance(true, freshJobs), // true = include trends, pass fresh jobs
        loadOSPatchCompliance(true, freshJobs), // pass fresh jobs
        loadRecentActivity(),
      ]);
    } catch (error) {
      console.error('[ClientDashboard] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const calculateOverallScore = (): number => {
    const networkWeight = 0.5;
    const osWeight = 0.5;
    return (networkMetrics.compliancePercentage * networkWeight) + 
           (osMetrics.compliancePercentage * osWeight);
  };

  const getTotalAssets = (): number => {
    return networkMetrics.totalItems + osMetrics.totalItems;
  };

  const getTotalCriticalIssues = (): number => {
    return networkMetrics.criticalIssues + osMetrics.criticalIssues;
  };

  const getOverallTrend = (): { value: number; direction: 'up' | 'down' | 'stable' } => {
    const avgTrend = (networkMetrics.trend + osMetrics.trend) / 2;
    let direction: 'up' | 'down' | 'stable' = 'stable';
    
    if (Math.abs(avgTrend) < 1) {
      direction = 'stable';
    } else if (avgTrend > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }
    
    return { value: avgTrend, direction };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: COLORS.primary }} />
          <div className="text-gray-600 dark:text-gray-400">Loading compliance data...</div>
        </div>
      </div>
    );
  }

  const overallScore = calculateOverallScore();
  const overallRisk = getRiskLevel(overallScore);
  const networkRisk = getRiskLevel(networkMetrics.compliancePercentage);
  const osRisk = getRiskLevel(osMetrics.compliancePercentage);
  const overallTrend = getOverallTrend();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Professional Header with Logos */}
      <div 
        className="relative overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
          borderBottom: `5px solid ${COLORS.primary}`,
          boxShadow: '0 10px 40px rgba(59, 130, 246, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Subtle decorative background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${COLORS.primary} 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 relative z-10">
          <div className="flex items-center justify-between gap-8">
            {/* Left: Intuitive Surgical Logo with hover effect */}
              <img 
                src={intuitiveLogo} 
                alt="Intuitive Surgical" 
                className="h-28 lg:h-32 object-contain filter brightness-100 contrast-105"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))' }}
              />
            
            {/* Center: Title and Subtitle with decorative elements */}
            <div className="flex-grow flex flex-col items-center justify-center text-center px-8">
              {/* Decorative top line */}
              <div 
                className="w-24 h-1 rounded-full mb-4"
                style={{ 
                  background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
                  boxShadow: `0 2px 8px ${COLORS.primary}40`
                }}
              />
              
              <h1 
                className="text-4xl lg:text-5xl font-extrabold mb-3 tracking-tight"
                style={{ 
                  color: COLORS.primary,
                  textShadow: '0 2px 10px rgba(59, 130, 246, 0.15)',
                  letterSpacing: '-0.02em'
                }}
              >
                Compliance Dashboard
              </h1>
              
              {/* Decorative divider */}
              <div 
                className="w-32 h-0.5 mb-3"
                style={{ 
                  background: `linear-gradient(90deg, ${COLORS.accent}40, ${COLORS.accent}, ${COLORS.accent}40)`,
                }}
              />
              
              <p 
                className="text-gray-600 dark:text-gray-400 text-base font-medium tracking-wide"
                style={{ letterSpacing: '0.02em' }}
              >
                Real-time Network & OS Compliance Monitoring
              </p>
              
              {/* Decorative bottom line */}
              <div 
                className="w-24 h-1 rounded-full mt-4"
                style={{ 
                  background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
                  boxShadow: `0 2px 8px ${COLORS.accent}40`
                }}
              />
            </div>
            
            {/* Right: Jade Global Logo with hover effect */}
              <img 
                src={jadeLogo} 
                alt="Jade Global" 
                className="h-[85px] lg:h-[100px] object-contain filter brightness-100 contrast-105"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))' }}
              />
          </div>
        </div>
        
        {/* Bottom accent gradient line */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${COLORS.primary}00, ${COLORS.primary}, ${COLORS.accent}, ${COLORS.primary}, ${COLORS.primary}00)`,
            opacity: 0.6
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Executive Summary Cards with Refresh Button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
            style={{ backgroundColor: COLORS.accent }}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Overall Compliance Score */}
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 relative group cursor-help" 
            style={{ borderTopColor: COLORS.primary }}
            title={`Overall Compliance: ${overallScore.toFixed(1)}%\n\nCalculation: (Network ${networkMetrics.compliancePercentage.toFixed(1)}% × 50%) + (OS ${osMetrics.compliancePercentage.toFixed(1)}% × 50%)\n\nRisk Levels:\n🟢 LOW: ≥90% compliant\n🟡 MEDIUM: 70-89% compliant\n🔴 HIGH: <70% compliant\n\nCurrent Status: ${overallRisk.level}\nReason: ${overallScore < 70 ? 'Overall compliance is below 70% threshold' : overallScore < 90 ? 'Overall compliance is between 70-89%' : 'Overall compliance is above 90%'}${overallScore < 70 ? '\n\n⚠️ Action Required: ' + (networkMetrics.compliancePercentage < 70 ? 'Network compliance is low. ' : '') + (osMetrics.compliancePercentage < 70 ? 'OS patch compliance is critically low.' : '') : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" style={{ color: COLORS.primary }} />
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Overall Score</h3>
                <HelpCircle className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {overallTrend.direction === 'up' && <TrendingUp className="h-5 w-5" style={{ color: COLORS.success }} />}
              {overallTrend.direction === 'down' && <TrendingDown className="h-5 w-5" style={{ color: COLORS.critical }} />}
              {overallTrend.direction === 'stable' && <Minus className="h-5 w-5 text-gray-400" />}
            </div>
            <div className="text-4xl font-bold mb-1" style={{ color: overallRisk.color }}>
              {overallScore.toFixed(1)}%
            </div>
            <div className="text-sm font-medium" style={{ color: overallRisk.color }}>
              {overallRisk.emoji} {overallRisk.level}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Hover for calculation details
            </div>
          </div>

          {/* Total Assets Monitored */}
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 relative group cursor-help" 
            style={{ borderTopColor: COLORS.lightBlue }}
            title={`Total Assets: ${getTotalAssets()} items\n\nBreakdown:\n• Network Devices: ${networkMetrics.totalItems}\n• OS Packages/Systems: ${osMetrics.totalItems}\n\nWhat counts as an asset:\n• Network: Individual network devices/switches/routers\n• OS: Individual packages or systems being monitored\n\nAll assets are actively monitored for compliance.`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5" style={{ color: COLORS.lightBlue }} />
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Assets</h3>
              <HelpCircle className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-4xl font-bold mb-1 text-gray-900 dark:text-white">
              {getTotalAssets()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {networkMetrics.totalItems} Network + {osMetrics.totalItems} OS
            </div>
          </div>

          {/* Critical Issues */}
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 relative group cursor-help" 
            style={{ borderTopColor: COLORS.critical }}
            title={`Critical Issues: ${getTotalCriticalIssues()} items\n\nBreakdown:\n• Network Issues: ${networkMetrics.criticalIssues} device(s)\n• OS Issues: ${osMetrics.criticalIssues} package(s)\n\nWhat counts as critical:\n• Network: Devices with non-compliant firmware\n• OS: Packages with missing patches or updates\n\n${getTotalCriticalIssues() > 0 ? '⚠️ These items require immediate attention!' : '✅ No critical issues detected'}${networkMetrics.criticalIssues > 0 ? '\n\nNetwork Alert: ' + networkMetrics.criticalIssues + ' device(s) need firmware updates' : ''}${osMetrics.criticalIssues > 0 ? '\n\nOS Alert: ' + osMetrics.criticalIssues + ' package(s) need patches' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5" style={{ color: COLORS.critical }} />
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Critical Issues</h3>
              <HelpCircle className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-4xl font-bold mb-1" style={{ color: COLORS.critical }}>
              {getTotalCriticalIssues()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {networkMetrics.criticalIssues} Network + {osMetrics.criticalIssues} OS
            </div>
          </div>

          {/* Last Updated */}
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 relative group cursor-help" 
            style={{ borderTopColor: COLORS.accent }}
            title={`Last Data Refresh: ${networkMetrics.lastJobTime || 'No data available'}\n\nData Sources:\n• Network Job ID: ${networkMetrics.jobId || 'N/A'}\n• OS Job ID: ${osMetrics.jobId || 'N/A'}\n\nThis shows when compliance data was last collected from your infrastructure.\n\nClick 'Refresh Data' button to get the latest information.`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5" style={{ color: COLORS.accent }} />
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Last Updated</h3>
              <HelpCircle className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {networkMetrics.lastJobTime ? new Date(networkMetrics.lastJobTime).toLocaleTimeString() : 'N/A'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {networkMetrics.lastJobTime ? new Date(networkMetrics.lastJobTime).toLocaleDateString() : 'No data'}
            </div>
          </div>
        </div>

        {/* Risk Score Matrix */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.primary }}>
              <Shield className="h-6 w-6" />
              Risk Score Matrix
            </h2>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Info className="h-4 w-4" />
              Hover over cells for detailed information
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderBottomColor: COLORS.primary }}>
                  <th className="text-left py-4 px-4 font-bold text-gray-700 dark:text-gray-300"></th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: COLORS.purple }}>
                    <div className="flex items-center justify-center gap-2">
                      <Network className="h-5 w-5" />
                      Network Firmware
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: COLORS.success }}>
                    <div className="flex items-center justify-center gap-2">
                      <Package className="h-5 w-5" />
                      OS Patch
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      Compliance %
                      <span className="text-xs text-gray-400" title="Percentage of compliant items out of total monitored items">ⓘ</span>
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help" 
                    title={`Network Firmware Compliance: ${networkMetrics.compliancePercentage.toFixed(1)}%\n\nCompliant: ${networkMetrics.compliantCount} of ${networkMetrics.totalItems}\nNon-Compliant: ${networkMetrics.nonCompliantCount}\n\nThis means ${networkMetrics.compliancePercentage.toFixed(1)}% of network devices have up-to-date firmware.\n\n${networkMetrics.compliancePercentage < 70 ? '⚠️ Below 70% is considered HIGH RISK' : networkMetrics.compliancePercentage < 90 ? '⚠️ 70-89% is MEDIUM RISK' : '✅ Above 90% is LOW RISK'}`}
                  >
                    <span className="text-2xl font-bold" style={{ color: networkRisk.color }}>
                      {networkMetrics.compliancePercentage.toFixed(1)}%
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {networkMetrics.compliantCount}/{networkMetrics.totalItems} devices
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`OS Patch Compliance: ${osMetrics.compliancePercentage.toFixed(1)}%\n\nCompliant: ${osMetrics.compliantCount} of ${osMetrics.totalItems}\nNon-Compliant: ${osMetrics.nonCompliantCount}\n\nThis means ${osMetrics.compliancePercentage.toFixed(1)}% of packages/systems have all required patches installed.\n\n${osMetrics.compliancePercentage < 70 ? '⚠️ Below 70% is considered HIGH RISK' : osMetrics.compliancePercentage < 90 ? '⚠️ 70-89% is MEDIUM RISK' : '✅ Above 90% is LOW RISK'}`}
                  >
                    <span className="text-2xl font-bold" style={{ color: osRisk.color }}>
                      {osMetrics.compliancePercentage.toFixed(1)}%
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {osMetrics.compliantCount}/{osMetrics.totalItems} packages
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      Risk Level
                      <span className="text-xs text-gray-400" title="Based on compliance percentage thresholds">ⓘ</span>
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`Network Risk: ${networkRisk.level}\n\nReason: Compliance is ${networkMetrics.compliancePercentage.toFixed(1)}%\n\nRisk Thresholds:\n🟢 LOW: ≥90% compliant\n🟡 MEDIUM: 70-89% compliant\n🔴 HIGH: <70% compliant\n\nCurrent Status: ${networkMetrics.compliancePercentage >= 90 ? 'Excellent - Most devices are compliant' : networkMetrics.compliancePercentage >= 70 ? 'Moderate - Some devices need attention' : 'Critical - Many devices are non-compliant'}\n\n${networkMetrics.nonCompliantCount > 0 ? `Action Required: Update firmware on ${networkMetrics.nonCompliantCount} device(s)` : 'All devices are compliant!'}`}
                  >
                    <span className="font-bold" style={{ color: networkRisk.color }}>
                      {networkRisk.emoji} {networkRisk.level}
                    </span>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`OS Risk: ${osRisk.level}\n\nReason: Compliance is ${osMetrics.compliancePercentage.toFixed(1)}%\n\nRisk Thresholds:\n🟢 LOW: ≥90% compliant\n🟡 MEDIUM: 70-89% compliant\n🔴 HIGH: <70% compliant\n\nCurrent Status: ${osMetrics.compliancePercentage >= 90 ? 'Excellent - Most packages are patched' : osMetrics.compliancePercentage >= 70 ? 'Moderate - Some packages need updates' : 'Critical - Many packages are missing patches'}\n\n${osMetrics.nonCompliantCount > 0 ? `Action Required: Install patches for ${osMetrics.nonCompliantCount} package(s)` : 'All packages are up to date!'}`}
                  >
                    <span className="font-bold" style={{ color: osRisk.color }}>
                      {osRisk.emoji} {osRisk.level}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      Trend (2 jobs)
                      <span className="text-xs text-gray-400" title="Compliance change compared to average of last 2 historical jobs">ⓘ</span>
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`Network Trend: ${networkMetrics.trend >= 0 ? '+' : ''}${networkMetrics.trend.toFixed(1)}%\n\nThis compares current compliance (${networkMetrics.compliancePercentage.toFixed(1)}%) to the average of the last 2 historical scans.\n\n${networkMetrics.trendDirection === 'up' ? '📈 Improving - Compliance is increasing' : networkMetrics.trendDirection === 'down' ? '📉 Declining - Compliance is decreasing' : '➡️ Stable - No significant change (within ±1%)'}\n\nTrend shows if network compliance is getting better or worse over time.`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {networkMetrics.trendDirection === 'up' && <TrendingUp className="h-5 w-5" style={{ color: COLORS.success }} />}
                      {networkMetrics.trendDirection === 'down' && <TrendingDown className="h-5 w-5" style={{ color: COLORS.critical }} />}
                      {networkMetrics.trendDirection === 'stable' && <Minus className="h-5 w-5 text-gray-400" />}
                      <span className="font-semibold" style={{ color:
                        networkMetrics.trendDirection === 'up' ? COLORS.success :
                        networkMetrics.trendDirection === 'down' ? COLORS.critical : '#6b7280'
                      }}>
                        {networkMetrics.trend > 0 ? '+' : ''}{networkMetrics.trend.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`OS Trend: ${osMetrics.trend >= 0 ? '+' : ''}${osMetrics.trend.toFixed(1)}%\n\nThis compares current compliance (${osMetrics.compliancePercentage.toFixed(1)}%) to the average of the last 2 historical scans.\n\n${osMetrics.trendDirection === 'up' ? '📈 Improving - More patches are being applied' : osMetrics.trendDirection === 'down' ? '📉 Declining - Patch compliance is decreasing' : '➡️ Stable - No significant change (within ±1%)'}\n\nTrend shows if OS patching is getting better or worse over time.`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {osMetrics.trendDirection === 'up' && <TrendingUp className="h-5 w-5" style={{ color: COLORS.success }} />}
                      {osMetrics.trendDirection === 'down' && <TrendingDown className="h-5 w-5" style={{ color: COLORS.critical }} />}
                      {osMetrics.trendDirection === 'stable' && <Minus className="h-5 w-5 text-gray-400" />}
                      <span className="font-semibold" style={{ color:
                        osMetrics.trendDirection === 'up' ? COLORS.success :
                        osMetrics.trendDirection === 'down' ? COLORS.critical : '#6b7280'
                      }}>
                        {osMetrics.trend > 0 ? '+' : ''}{osMetrics.trend.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      Critical Issues
                      <span className="text-xs text-gray-400" title="Number of non-compliant items requiring immediate attention">ⓘ</span>
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`Network Critical Issues: ${networkMetrics.criticalIssues}\n\nThese are network devices with non-compliant firmware versions.\n\n${networkMetrics.criticalIssues > 0 ? `⚠️ ${networkMetrics.criticalIssues} device(s) need firmware updates\n\nAction: Review device list and schedule firmware updates` : '✅ No critical issues - All devices have compliant firmware'}`}
                  >
                    <span className="text-xl font-bold" style={{ color: COLORS.critical }}>
                      {networkMetrics.criticalIssues}
                    </span>
                  </td>
                  <td 
                    className="py-4 px-4 text-center cursor-help"
                    title={`OS Critical Issues: ${osMetrics.criticalIssues}\n\nThese are packages or systems missing required security patches.\n\n${osMetrics.criticalIssues > 0 ? `⚠️ ${osMetrics.criticalIssues} package(s) need patches\n\nAction: Review patch list and schedule maintenance window for updates` : '✅ No critical issues - All packages are up to date'}`}
                  >
                    <span className="text-xl font-bold" style={{ color: COLORS.critical }}>
                      {osMetrics.criticalIssues}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Network Firmware Compliance */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: COLORS.purple }}>
                <Network className="h-6 w-6" />
                Network Device Firmware Compliance
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Firmware compliance status across all network devices
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {networkMetrics.compliance && (
                  <>
                    <DynamicChart
                      chartId="network-compliance-pie"
                      initialMetric="network-device-compliance"
                      initialChartType="pie"
                      initialTimeRange="all"
                      data={{
                        'network-device-compliance': Object.entries(networkMetrics.compliance).map(([name, value]) => ({ name, value }))
                      }}
                      onRemove={() => {}}
                      onMetricChange={() => {}}
                      onChartTypeChange={() => {}}
                      onTimeRangeChange={() => {}}
                    />
                    <DynamicChart
                      chartId="network-compliance-bar"
                      initialMetric="network-device-compliance"
                      initialChartType="bar"
                      initialTimeRange="all"
                      data={{
                        'network-device-compliance': Object.entries(networkMetrics.compliance).map(([name, value]) => ({ name, value }))
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

        {/* OS Patch Compliance */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: COLORS.success }}>
                <Package className="h-6 w-6" />
                Operating System Patch Compliance
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Operating system patch and update compliance status
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {osMetrics.compliance && (
                  <>
                    <DynamicChart
                      chartId="os-patch-compliance-pie"
                      initialMetric="compliance-status"
                      initialChartType="pie"
                      initialTimeRange="all"
                      data={{
                        'compliance-status': Object.entries(osMetrics.compliance).map(([name, value]) => ({ name, value }))
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
                        'compliance-status': Object.entries(osMetrics.compliance).map(([name, value]) => ({ name, value }))
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

        {/* Recent Activity Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.accent }}>
            <Clock className="h-6 w-6" />
            Recent Activity
          </h2>
          
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="flex-shrink-0">
                    {activity.type === 'network' ? (
                      <Network className="h-5 w-5" style={{ color: COLORS.purple }} />
                    ) : (
                      <Package className="h-5 w-5" style={{ color: COLORS.success }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {activity.timestamp}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {activity.status === 'success' && (
                      <div className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: COLORS.success, color: 'white' }}>
                        Success
                      </div>
                    )}
                    {activity.status === 'warning' && (
                      <div className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: COLORS.warning, color: 'white' }}>
                        Issues Found
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No recent activity to display
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
