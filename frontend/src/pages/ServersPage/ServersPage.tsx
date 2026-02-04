/**
 * ServersPage Component
 * Manage servers with CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle, RefreshCw, X, Info } from 'lucide-react';
import { serversApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import type { Server, ServerCreateRequest } from '../../types';

export const ServersPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [loadingServerMetrics, setLoadingServerMetrics] = useState(false);
  const [serverMetrics, setServerMetrics] = useState<{
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    last_monitored: string | null;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOS, setFilterOS] = useState<string>('all');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [formData, setFormData] = useState<ServerCreateRequest>({
    hostname: '',
    ip_address: '',
    os_type: 'linux',
    ssh_user: 'root',
    ssh_port: 22,
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canEdit = isAdmin;

  useEffect(() => {
    loadServers();
  }, []);

  // Fetch server metrics when details modal opens and refresh every 5 seconds
  useEffect(() => {
    if (showDetailsModal && selectedServer) {
      // Initial fetch
      fetchServerMetrics(selectedServer.id);
      
      // Set up interval for auto-refresh
      const intervalId = setInterval(() => {
        fetchServerMetrics(selectedServer.id);
      }, 5000); // 5 seconds
      
      // Cleanup interval when modal closes
      return () => clearInterval(intervalId);
    }
  }, [showDetailsModal, selectedServer]);

  const fetchServerMetrics = async (serverId: number) => {
    try {
      setLoadingServerMetrics(true);
      const metrics = await serversApi.getMetrics(serverId);
      setServerMetrics(metrics);
    } catch (error) {
      console.error('Failed to fetch server metrics:', error);
      // Keep last known values on error
    } finally {
      setLoadingServerMetrics(false);
    }
  };

  const handleManualRefreshMetrics = async () => {
    if (selectedServer) {
      await fetchServerMetrics(selectedServer.id);
      addNotification('success', 'Server metrics refreshed');
    }
  };

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await serversApi.list({ per_page: 100 });
      setServers(response.items);
    } catch (error) {
      console.error('Failed to load servers:', error);
      addNotification('error', 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingServer(null);
    setFormData({
      hostname: '',
      ip_address: '',
      os_type: 'linux',
      ssh_user: 'root',
      ssh_port: 22,
      tags: [],
    });
    setTagInput('');
    setShowModal(true);
  };

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setFormData({
      hostname: server.hostname,
      ip_address: server.ip_address,
      os_type: server.os_type,
      os_version: server.os_version,
      ssh_user: server.ssh_user,
      ssh_port: server.ssh_port,
      ssh_key_path: server.ssh_key_path,
      tags: server.tags || [],
      environment: server.environment,
      description: server.description,
    });
    setTagInput('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare data for backend
      const serverData = {
        hostname: formData.hostname,
        ip_address: formData.ip_address,
        os_type: formData.os_type || 'linux',
        os_version: formData.os_version,
        ssh_user: formData.ssh_user,
        ssh_port: formData.ssh_port,
        ssh_key_path: formData.ssh_key_path,
        tags: formData.tags || [],
      };

      console.log('Sending server data:', serverData);

      if (editingServer) {
        await serversApi.update(editingServer.id, serverData);
        addNotification('success', 'Server updated successfully');
      } else {
        await serversApi.create(serverData);
        addNotification('success', 'Server created successfully');
      }
      setShowModal(false);
      loadServers();
    } catch (error: any) {
      console.error('Server operation error:', error);
      console.error('Error response:', error.response?.data);
      addNotification('error', error.response?.data?.message || error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this server?')) {
      return;
    }

    try {
      await serversApi.delete(id);
      addNotification('success', 'Server deleted successfully');
      loadServers();
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Delete failed');
    }
  };

  const handleTestConnection = async (id: number) => {
    try {
      const result = await serversApi.testConnection(id);
      addNotification(
        result.success ? 'success' : 'error',
        result.message
      );
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Connection test failed');
    }
  };

  const handleRefreshMetrics = async () => {
    try {
      setRefreshingMetrics(true);
      const result = await serversApi.refreshAllMetrics();
      addNotification('success', `Metrics refreshed for ${result.servers_updated} servers`);
      // Reload servers to get updated metrics
      await loadServers();
    } catch (error: any) {
      addNotification('error', error.response?.data?.message || 'Failed to refresh metrics');
    } finally {
      setRefreshingMetrics(false);
    }
  };

  const filteredServers = servers.filter((server) => {
    const matchesSearch = 
      server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ip_address.includes(searchTerm) ||
      server.environment?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOS = filterOS === 'all' || server.os_type === filterOS;
    const matchesEnvironment = filterEnvironment === 'all' || server.environment === filterEnvironment;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'online' && server.is_active) || 
      (filterStatus === 'offline' && !server.is_active);
    
    return matchesSearch && matchesOS && matchesEnvironment && matchesStatus;
  });

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Online</span>;
    }
    return <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Offline</span>;
  };

  const getEnvironmentBadge = (env?: string) => {
    if (!env) return null;
    const colors = {
      production: 'bg-purple-100 text-purple-700',
      staging: 'bg-yellow-100 text-yellow-700',
      dev: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded uppercase ${colors[env as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
        {env}
      </span>
    );
  };

  const getCPUColor = (usage: number) => {
    if (usage >= 80) return 'bg-red-500';
    if (usage >= 60) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Server Inventory</h2>
        </div>
      </div>

      {/* Search, Add Button and Refresh */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search servers by name, IP, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white text-gray-900 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 shadow-glow"
          />
        </div>
        
        {/* Filter Dropdowns */}
        <select
          value={filterOS}
          onChange={(e) => setFilterOS(e.target.value)}
          className="px-4 py-3 bg-white text-gray-900 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow cursor-pointer"
        >
          <option value="all">All OS</option>
          <option value="linux">Linux</option>
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
        </select>
        
        <select
          value={filterEnvironment}
          onChange={(e) => setFilterEnvironment(e.target.value)}
          className="px-4 py-3 bg-white text-gray-900 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow cursor-pointer"
        >
          <option value="all">All Environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="dev">Development</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white text-gray-900 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-glow-sm hover:shadow-glow whitespace-nowrap"
        >
          <Plus className="h-5 w-5" />
          Add New Server
        </button>
        <button
          onClick={loadServers}
          className="p-3 bg-gray-200 hover:bg-gray-300 text-gray-700 border border-primary-200 rounded-lg transition-colors shadow-glow-sm hover:shadow-glow"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Server Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  OS / Distro
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{server.hostname}</div>
                        <div className="flex gap-2 mt-1">
                          {server.environment && getEnvironmentBadge(server.environment)}
                          {server.description && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded uppercase bg-gray-100 text-gray-600">
                              {server.description.substring(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {server.tags && server.tags.length > 0 ? (
                        server.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No tags</span>
                      )}
                      {server.tags && server.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{server.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700 font-mono">{server.ip_address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(server.is_active)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">
                      {server.os_version || server.os_type.charAt(0).toUpperCase() + server.os_type.slice(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {/* Details button - visible for all users */}
                      <button
                        onClick={() => {
                          setSelectedServer(server);
                          setShowDetailsModal(true);
                        }}
                        className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-md inline-flex items-center gap-1 transition-colors"
                        title="View Details"
                      >
                        <Info className="h-4 w-4" />
                        Details
                      </button>
                      {/* Edit and Delete buttons - only for admin and super_admin */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(server)}
                            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md inline-flex items-center gap-1 transition-colors"
                            title="Edit Server"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(server.id)}
                            className="px-3 py-1.5 bg-error-500 hover:bg-error-600 text-white rounded-md inline-flex items-center gap-1 transition-colors"
                            title="Delete Server"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredServers.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-600">No servers found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-xl w-full max-w-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Provision New Server
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hostname *
                  </label>
                  <input
                    type="text"
                    placeholder="web-server-01"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OS Type *
                  </label>
                  <select
                    value={formData.os_type}
                    onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
                    required
                  >
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OS Version
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ubuntu 22.04"
                    value={formData.os_version || ''}
                    onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SSH Port *
                  </label>
                  <input
                    type="number"
                    placeholder="22"
                    value={formData.ssh_port}
                    onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SSH User *
                  </label>
                  <input
                    type="text"
                    placeholder="root"
                    value={formData.ssh_user}
                    onChange={(e) => setFormData({ ...formData, ssh_user: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SSH Key Path
                </label>
                <input
                  type="text"
                  placeholder="/path/to/private_key"
                  value={formData.ssh_key_path || ''}
                  onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags <span className="text-gray-500 text-xs">(for grouping servers)</span>
                </label>
                <div className="space-y-2">
                  {/* Tag input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add tag (e.g., production, web-server)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          e.preventDefault();
                          const newTag = tagInput.trim();
                          if (!formData.tags?.includes(newTag)) {
                            setFormData({ ...formData, tags: [...(formData.tags || []), newTag] });
                          }
                          setTagInput('');
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tagInput.trim()) {
                          const newTag = tagInput.trim();
                          if (!formData.tags?.includes(newTag)) {
                            setFormData({ ...formData, tags: [...(formData.tags || []), newTag] });
                          }
                          setTagInput('');
                        }
                      }}
                      className="px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                  {/* Display tags */}
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                tags: formData.tags?.filter((_, i) => i !== index)
                              });
                            }}
                            className="hover:text-primary-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-gray-700 bg-gray-200 hover:bg-gray-300 border border-gray-300 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium shadow-sm"
                >
                  Add Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Server Details Modal */}
      {showDetailsModal && selectedServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Server Details
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedServer(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary-500" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Hostname</p>
                    <p className="font-semibold text-gray-900">{selectedServer.hostname}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">IP Address</p>
                    <p className="font-semibold text-gray-900">{selectedServer.ip_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Operating System</p>
                    <p className="font-semibold text-gray-900">{selectedServer.os_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {selectedServer.is_active ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success-500" />
                          <span className="font-semibold text-success-600">Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-error-500" />
                          <span className="font-semibold text-error-600">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SSH Configuration */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SSH Configuration</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">SSH User</p>
                    <p className="font-semibold text-gray-900">{selectedServer.ssh_user}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">SSH Port</p>
                    <p className="font-semibold text-gray-900">{selectedServer.ssh_port}</p>
                  </div>
                  {selectedServer.ssh_key_path && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600 mb-1">SSH Key Path</p>
                      <p className="font-semibold text-gray-900 break-all">{selectedServer.ssh_key_path}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resource Usage */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Resource Usage</h4>
                  <div className="flex items-center gap-2">
                    {loadingServerMetrics && (
                      <span className="text-xs text-gray-500">Updating...</span>
                    )}
                    <button
                      onClick={handleManualRefreshMetrics}
                      disabled={loadingServerMetrics}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Refresh metrics"
                    >
                      <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${loadingServerMetrics ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  {/* CPU Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU Usage</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {serverMetrics?.cpu_usage !== null && serverMetrics?.cpu_usage !== undefined 
                          ? `${serverMetrics.cpu_usage.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
                          (serverMetrics?.cpu_usage || 0) > 80 ? 'bg-error-500' :
                          (serverMetrics?.cpu_usage || 0) > 60 ? 'bg-warning-500' :
                          'bg-success-500'
                        }`}
                        style={{ width: `${Math.min(serverMetrics?.cpu_usage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Memory Usage</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {serverMetrics?.memory_usage !== null && serverMetrics?.memory_usage !== undefined 
                          ? `${serverMetrics.memory_usage.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
                          (serverMetrics?.memory_usage || 0) > 80 ? 'bg-error-500' :
                          (serverMetrics?.memory_usage || 0) > 60 ? 'bg-warning-500' :
                          'bg-success-500'
                        }`}
                        style={{ width: `${Math.min(serverMetrics?.memory_usage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Disk Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Disk Usage</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {serverMetrics?.disk_usage !== null && serverMetrics?.disk_usage !== undefined 
                          ? `${serverMetrics.disk_usage.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
                          (serverMetrics?.disk_usage || 0) > 80 ? 'bg-error-500' :
                          (serverMetrics?.disk_usage || 0) > 60 ? 'bg-warning-500' :
                          'bg-success-500'
                        }`}
                        style={{ width: `${Math.min(serverMetrics?.disk_usage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Last Monitored */}
                  {serverMetrics?.last_monitored && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last updated: {new Intl.DateTimeFormat('en-US', {
                          timeZone: getUserTimezone(),
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }).format(new Date(serverMetrics.last_monitored))}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Timestamps</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Created At</p>
                    <p className="font-medium text-gray-900">{new Intl.DateTimeFormat('en-US', {
                      timeZone: getUserTimezone(),
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).format(new Date(selectedServer.created_at))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                    <p className="font-medium text-gray-900">{new Intl.DateTimeFormat('en-US', {
                      timeZone: getUserTimezone(),
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).format(new Date(selectedServer.updated_at))}</p>
                  </div>
                  {selectedServer.last_seen && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600 mb-1">Last Seen</p>
                      <p className="font-medium text-gray-900">{new Intl.DateTimeFormat('en-US', {
                        timeZone: getUserTimezone(),
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }).format(new Date(selectedServer.last_seen))}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedServer(null);
                }}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
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
