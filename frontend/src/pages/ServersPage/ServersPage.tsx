/**
 * ServersPage Component
 * Manage servers with CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle, MoreVertical, RefreshCw, ChevronRight, X } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [formData, setFormData] = useState<ServerCreateRequest>({
    hostname: '',
    ip_address: '',
    os_type: 'linux',
    ssh_user: 'root',
    ssh_port: 22,
  });

  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  useEffect(() => {
    loadServers();
  }, []);

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
    });
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
      environment: server.environment,
      description: server.description,
    });
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

  const filteredServers = servers.filter(
    (server) =>
      server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ip_address.includes(searchTerm) ||
      server.environment?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Online</span>;
    }
    return <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">Offline</span>;
  };

  const getEnvironmentBadge = (env?: string) => {
    if (!env) return null;
    const colors = {
      production: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
      staging: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
      dev: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded uppercase ${colors[env as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
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
        <div className="text-gray-500 dark:text-gray-400">Loading servers...</div>
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
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search servers by name, IP, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </div>
        {canEdit && (
          <button
            onClick={handleRefreshMetrics}
            disabled={refreshingMetrics}
            className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh server metrics (CPU, Memory, Disk)"
          >
            <RefreshCw className={`h-5 w-5 ${refreshingMetrics ? 'animate-spin' : ''}`} />
            {refreshingMetrics ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        )}
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-5 w-5" />
          Add New Server
        </button>
        <button
          onClick={loadServers}
          className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OS / Distro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredServers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedRow(expandedRow === server.id ? null : server.id)}
                        className="mr-3 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight 
                          className={`h-5 w-5 transition-transform ${expandedRow === server.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{server.hostname}</div>
                        <div className="flex gap-2 mt-1">
                          {server.environment && getEnvironmentBadge(server.environment)}
                          {server.description && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded uppercase bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {server.description.substring(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-mono">{server.ip_address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(server.is_active)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {server.os_version || server.os_type.charAt(0).toUpperCase() + server.os_type.slice(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-[100px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">CPU</span>
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {server.cpu_usage !== undefined && server.cpu_usage !== null 
                              ? `${server.cpu_usage.toFixed(1)}%` 
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getCPUColor(server.cpu_usage || 0)}`}
                            style={{ width: `${Math.min(server.cpu_usage || 0, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setExpandedRow(expandedRow === server.id ? null : server.id)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {expandedRow === server.id && canEdit && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => { handleTestConnection(server.id); setExpandedRow(null); }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Test Connection
                            </button>
                            <button
                              onClick={() => { handleEdit(server); setExpandedRow(null); }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Edit className="h-4 w-4 inline mr-2" />
                              Edit Server
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => { handleDelete(server.id); setExpandedRow(null); }}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4 inline mr-2" />
                                Delete Server
                              </button>
                            )}
                          </div>
                        </div>
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
            <p className="text-gray-500 dark:text-gray-400">No servers found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hostname *
                  </label>
                  <input
                    type="text"
                    placeholder="web-server-01"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OS Type *
                  </label>
                  <select
                    value={formData.os_type}
                    onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    required
                  >
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OS Version
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ubuntu 22.04"
                    value={formData.os_version || ''}
                    onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH Port *
                  </label>
                  <input
                    type="number"
                    placeholder="22"
                    value={formData.ssh_port}
                    onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH User *
                  </label>
                  <input
                    type="text"
                    placeholder="root"
                    value={formData.ssh_user}
                    onChange={(e) => setFormData({ ...formData, ssh_user: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SSH Key Path
                </label>
                <input
                  type="text"
                  placeholder="/path/to/private_key"
                  value={formData.ssh_key_path || ''}
                  onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  Add Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
