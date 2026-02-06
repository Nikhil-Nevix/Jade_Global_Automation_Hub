import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { serversApi } from '../../api/api';
import { patchAPI, Package } from '../../api/patches';
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Upload, 
  Server as ServerIcon,
  FileText,
  AlertTriangle,
  CheckSquare,
  XCircle
} from 'lucide-react';
import type { Server } from '../../types';

const PatchManagement: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedForInstall, setSelectedForInstall] = useState<Set<string>>(new Set());
  const [selectedForUpdate, setSelectedForUpdate] = useState<Set<string>>(new Set());
  
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load servers on component mount
  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await serversApi.list();
      setServers(response.items || []);
    } catch (err: any) {
      // Handle 401 by redirecting to login
      if (err.response?.status === 401) {
        console.warn('[PatchManagement] Unauthorized - redirecting to login');
        navigate('/login');
        return;
      }
      setError(err.response?.data?.error || 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await patchAPI.uploadCSV(file);
      
      if (response.success) {
        setCsvUploaded(true);
        setUploadedFileName(file.name);
        setSuccessMessage(`✅ CSV uploaded successfully! Found ${response.packages_count} package(s) to check.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload CSV file');
      setCsvUploaded(false);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCheckPackages = async () => {
    if (!selectedServerId) {
      setError('Please select a server first');
      return;
    }

    if (!csvUploaded) {
      setError('Please upload a CSV file first');
      return;
    }

    try {
      setChecking(true);
      setError(null);
      setSuccessMessage(null);
      setPackages([]);
      setSelectedForInstall(new Set());
      setSelectedForUpdate(new Set());

      const response = await patchAPI.checkPackages(selectedServerId);
      
      if (response.success) {
        setPackages(response.packages);
        setSuccessMessage(`✅ Checked ${response.total_count} package(s) on ${response.server.hostname}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check packages');
      setPackages([]);
    } finally {
      setChecking(false);
    }
  };

  const handleSelectForInstall = (packageName: string, checked: boolean) => {
    const newSelection = new Set(selectedForInstall);
    if (checked) {
      newSelection.add(packageName);
      // Remove from update list if present
      const updateList = new Set(selectedForUpdate);
      updateList.delete(packageName);
      setSelectedForUpdate(updateList);
    } else {
      newSelection.delete(packageName);
    }
    setSelectedForInstall(newSelection);
  };

  const handleSelectForUpdate = (packageName: string, checked: boolean) => {
    const newSelection = new Set(selectedForUpdate);
    if (checked) {
      newSelection.add(packageName);
      // Remove from install list if present
      const installList = new Set(selectedForInstall);
      installList.delete(packageName);
      setSelectedForInstall(installList);
    } else {
      newSelection.delete(packageName);
    }
    setSelectedForUpdate(newSelection);
  };

  const handleInstallPackages = async () => {
    if (!selectedServerId) {
      setError('Server selection lost. Please refresh and try again.');
      return;
    }

    if (selectedForInstall.size === 0) {
      setError('Please select at least one package to install');
      return;
    }

    try {
      setInstalling(true);
      setError(null);
      setSuccessMessage(null);

      const response = await patchAPI.installPackages({
        server_id: selectedServerId,
        packages: Array.from(selectedForInstall),
      });

      if (response.success) {
        setSuccessMessage(
          `✅ ${response.message}. Job ID: ${response.job.job_id}. Check Jobs page for status.`
        );
        
        setSelectedForInstall(new Set());
        
        setTimeout(() => {
          const goToJobs = window.confirm('Packages are being installed. Would you like to view the job status?');
          if (goToJobs) {
            navigate('/jobs');
          }
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to install packages');
    } finally {
      setInstalling(false);
    }
  };

  const handleUpdatePackages = async () => {
    if (!selectedServerId) {
      setError('Server selection lost. Please refresh and try again.');
      return;
    }

    if (selectedForUpdate.size === 0) {
      setError('Please select at least one package to update');
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const response = await patchAPI.updatePackages({
        server_id: selectedServerId,
        packages: Array.from(selectedForUpdate),
      });

      if (response.success) {
        setSuccessMessage(
          `✅ ${response.message}. Job ID: ${response.job.job_id}. Check Jobs page for status.`
        );
        
        setSelectedForUpdate(new Set());
        
        setTimeout(() => {
          const goToJobs = window.confirm('Packages are being updated. Would you like to view the job status?');
          if (goToJobs) {
            navigate('/jobs');
          }
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update packages');
    } finally {
      setUpdating(false);
    }
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

  // Filter packages by status
  const notInstalledPackages = packages.filter(p => p.status === 'not_installed');
  const updateAvailablePackages = packages.filter(p => p.status === 'update_available');
  const installedPackages = packages.filter(p => p.status === 'installed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'installed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">✓ Installed</span>;
      case 'not_installed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">✗ Not Installed</span>;
      case 'update_available':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">⚠ Update Available</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">⊘ Error</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patch Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload CSV, check package status, and install/update packages
          </p>
        </div>
        <ServerIcon className="h-8 w-8 text-jade-600" />
      </div>

      {/* Step 1: Upload CSV */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-jade-100 text-jade-600 mr-3">1</span>
          Upload Package List (CSV)
        </h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Upload a CSV file with package requirements. Format: <code className="bg-gray-100 px-2 py-1 rounded">package_name,required_version</code>
            </p>
            
            <div className="flex items-center space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all transform hover:scale-105 font-medium"
              >
                <Upload className="h-5 w-5" />
                <span>{uploading ? 'Uploading...' : 'Choose CSV File'}</span>
              </label>
              
              {csvUploaded && uploadedFileName && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-success-50 border border-success-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success-600" />
                  <span className="text-sm font-medium text-success-700">{uploadedFileName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start space-x-2">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>CSV Example:</strong>
                <pre className="mt-2 bg-white p-2 rounded text-xs overflow-x-auto">
{`package_name,required_version
vim,8.0
nginx,1.20
curl,7.7`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Select Server and Check */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-jade-100 text-jade-600 mr-3">2</span>
          Select Server & Check Packages
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="server" className="block text-sm font-medium text-gray-700 mb-2">
              Server
            </label>
            <select
              id="server"
              value={selectedServerId || ''}
              onChange={(e) => {
                setSelectedServerId(Number(e.target.value));
                setPackages([]);
                setSelectedForInstall(new Set());
                setSelectedForUpdate(new Set());
                setError(null);
                setSuccessMessage(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-jade-500"
              disabled={loading}
            >
              <option value="">-- Select a server --</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.hostname} ({server.ip_address})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCheckPackages}
              disabled={!selectedServerId || !csvUploaded || checking}
              className="w-full md:w-auto px-6 py-2 bg-jade-600 text-white rounded-md hover:bg-jade-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking...' : 'Check Packages'}</span>
            </button>
          </div>
        </div>

        {selectedServer && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Server:</h3>
            <div className="text-sm text-gray-600">
              <p><strong>Hostname:</strong> {selectedServer.hostname}</p>
              <p><strong>IP Address:</strong> {selectedServer.ip_address}</p>
              <p><strong>OS:</strong> {selectedServer.os_type} {selectedServer.os_version}</p>
            </div>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center space-x-2">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 3: Review and Take Action */}
      {packages.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-jade-100 text-jade-600 mr-3">3</span>
            Review & Take Action
          </h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Not Installed</p>
                  <p className="text-2xl font-bold text-red-900">{notInstalledPackages.length}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">Updates Available</p>
                  <p className="text-2xl font-bold text-yellow-900">{updateAvailablePackages.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Up to Date</p>
                  <p className="text-2xl font-bold text-green-900">{installedPackages.length}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Packages Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latest Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packages.map((pkg, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {pkg.package_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pkg.required_version}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pkg.current_version || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pkg.latest_version || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(pkg.status)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {pkg.status === 'not_installed' && (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedForInstall.has(pkg.package_name)}
                            onChange={(e) => handleSelectForInstall(pkg.package_name, e.target.checked)}
                            className="h-4 w-4 text-jade-600 focus:ring-jade-500 border-gray-300 rounded"
                          />
                          <span className="text-blue-600">Install</span>
                        </label>
                      )}
                      {pkg.status === 'update_available' && (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedForUpdate.has(pkg.package_name)}
                            onChange={(e) => handleSelectForUpdate(pkg.package_name, e.target.checked)}
                            className="h-4 w-4 text-jade-600 focus:ring-jade-500 border-gray-300 rounded"
                          />
                          <span className="text-orange-600">Update</span>
                        </label>
                      )}
                      {pkg.status === 'installed' && (
                        <span className="text-green-600">✓ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-4">
            <button
              onClick={handleInstallPackages}
              disabled={selectedForInstall.size === 0 || installing}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Download className={`h-4 w-4 ${installing ? 'animate-bounce' : ''}`} />
              <span>
                {installing
                  ? 'Installing...'
                  : `Install Selected (${selectedForInstall.size})`}
              </span>
            </button>

            <button
              onClick={handleUpdatePackages}
              disabled={selectedForUpdate.size === 0 || updating}
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
              <span>
                {updating
                  ? 'Updating...'
                  : `Update Selected (${selectedForUpdate.size})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!checking && packages.length === 0 && csvUploaded && selectedServerId && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No packages checked yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Click "Check Packages" to scan the selected server for package status.
          </p>
        </div>
      )}
    </div>
  );
};

export default PatchManagement;
