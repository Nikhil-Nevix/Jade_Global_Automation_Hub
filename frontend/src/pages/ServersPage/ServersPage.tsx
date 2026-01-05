/**
 * ServersPage Component
 * Manage servers with CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { serversApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import type { Server, ServerCreateRequest } from '../../types';

export const ServersPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
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
      if (editingServer) {
        await serversApi.update(editingServer.id, formData);
        addNotification('success', 'Server updated successfully');
      } else {
        await serversApi.create(formData);
        addNotification('success', 'Server created successfully');
      }
      setShowModal(false);
      loadServers();
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Operation failed');
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

  const filteredServers = servers.filter(
    (server) =>
      server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ip_address.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Servers</h2>
          <p className="text-gray-600 mt-1">Manage your infrastructure servers</p>
        </div>
        {canEdit && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Server
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search servers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Servers grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServers.map((server) => (
          <div key={server.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{server.hostname}</h3>
                <p className="text-sm text-gray-500">{server.ip_address}</p>
              </div>
              <div className="flex items-center gap-1">
                {server.is_active ? (
                  <CheckCircle className="h-5 w-5 text-success-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">OS:</span>
                <span className="font-medium text-gray-900">{server.os_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SSH User:</span>
                <span className="font-medium text-gray-900">{server.ssh_user}</span>
              </div>
              {server.environment && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Environment:</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                    {server.environment}
                  </span>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => handleTestConnection(server.id)}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => handleEdit(server)}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                >
                  <Edit className="h-4 w-4 inline mr-1" />
                  Edit
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="px-3 py-1.5 text-sm bg-error-50 text-error-600 rounded hover:bg-error-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredServers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No servers found</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingServer ? 'Edit Server' : 'Add New Server'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hostname *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OS Type *
                  </label>
                  <select
                    required
                    value={formData.os_type}
                    onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OS Version
                  </label>
                  <input
                    type="text"
                    value={formData.os_version || ''}
                    onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH User *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ssh_user}
                    onChange={(e) => setFormData({ ...formData, ssh_user: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={formData.ssh_port}
                    onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Key Path
                </label>
                <input
                  type="text"
                  value={formData.ssh_key_path || ''}
                  onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="/path/to/private_key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment
                </label>
                <select
                  value={formData.environment || ''}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select environment</option>
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  {editingServer ? 'Update Server' : 'Create Server'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
