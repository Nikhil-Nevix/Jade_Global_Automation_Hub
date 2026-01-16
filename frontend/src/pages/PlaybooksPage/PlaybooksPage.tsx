/**
 * PlaybooksPage Component
 * Manage Ansible playbooks with upload and CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { Search, Upload, Trash2, Play, RefreshCw, X, UploadCloud } from 'lucide-react';
import { playbooksApi, serversApi, jobsApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import type { Playbook, Server } from '../../types';

export const PlaybooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [uploadData, setUploadData] = useState({
    file: null as File | null,
    name: '',
    description: '',
  });

  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playbooksResponse, serversResponse] = await Promise.all([
        playbooksApi.list({ per_page: 100, is_active: true }),
        serversApi.list({ per_page: 100, is_active: true }),
      ]);
      setPlaybooks(playbooksResponse.items);
      setServers(serversResponse.items);
    } catch (error) {
      console.error('Failed to load data:', error);
      addNotification('error', 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadData({
        ...uploadData,
        file,
        name: uploadData.name || file.name.replace('.yml', '').replace('.yaml', ''),
      });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) {
      addNotification('error', 'Please select a file');
      return;
    }

    try {
      await playbooksApi.upload(uploadData.file, uploadData.name, uploadData.description);
      addNotification('success', 'Playbook uploaded successfully');
      setShowUploadModal(false);
      setUploadData({ file: null, name: '', description: '' });
      loadData();
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Upload failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this playbook?')) {
      return;
    }

    try {
      // Remove playbook from UI immediately (optimistic update)
      setPlaybooks(prevPlaybooks => prevPlaybooks.filter(p => p.id !== id));
      
      // Then make the API call
      await playbooksApi.delete(id);
      addNotification('success', 'Playbook deleted successfully');
    } catch (error: any) {
      // If API call fails, reload playbooks to restore correct state
      console.error('Failed to delete playbook:', error);
      addNotification('error', error.response?.data?.error || 'Delete failed');
      loadData(); // Reload to restore state
    }
  };

  const handleRun = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setShowRunModal(true);
  };

  const handleExecute = async () => {
    if (!selectedPlaybook || !selectedServerId) {
      addNotification('error', 'Please select a server');
      return;
    }

    try {
      const job = await jobsApi.create({
        playbook_id: selectedPlaybook.id,
        server_id: selectedServerId,
      });
      addNotification('success', 'Job created successfully');
      setShowRunModal(false);
      navigate(`/jobs/${job.id}`);
    } catch (error: any) {
      addNotification('error', error.response?.data?.error || 'Failed to create job');
    }
  };

  const filteredPlaybooks = playbooks.filter((playbook) =>
    playbook.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading playbooks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold dark:text-white">Ansible Playbooks</h2>
        </div>
      </div>

      {/* Search, Upload Button and Refresh */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search playbooks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
        >
          <Upload className="h-5 w-5" />
          Upload YAML
        </button>
        <button
          onClick={loadData}
          className="p-3 bg-gray-800 text-white border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Playbooks list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                File Path
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
            {filteredPlaybooks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No playbooks found
                </td>
              </tr>
            ) : (
              filteredPlaybooks.map((playbook) => (
                <tr key={playbook.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{playbook.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {playbook.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {playbook.file_path}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(playbook.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {canEdit && (
                      <button
                        onClick={() => handleRun(playbook)}
                        className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1"
                      >
                        <Play className="h-4 w-4" />
                        Run
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(playbook.id)}
                        className="text-error-600 hover:text-error-900 inline-flex items-center gap-1 ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upload Ansible Playbook
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpload} className="px-6 py-6 space-y-5">
              {/* File Upload Area */}
              <div>
                <label
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-12 h-12 mb-3 text-gray-400 dark:text-gray-500" />
                    <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">YAML files only (max 2MB)</p>
                    {uploadData.file && (
                      <p className="mt-2 text-sm text-blue-600 font-medium">
                        Selected: {uploadData.file.name}
                      </p>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleFileChange}
                    required
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Playbook Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="My New Playbook"
                  value={uploadData.name}
                  onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  rows={3}
                  placeholder="Enter playbook description..."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Run Modal */}
      {showRunModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Run Playbook: {selectedPlaybook.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Target Server *
                </label>
                <select
                  value={selectedServerId || ''}
                  onChange={(e) => setSelectedServerId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Choose a server...</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.hostname} ({server.ip_address})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleExecute}
                  disabled={!selectedServerId}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Execute
                </button>
                <button
                  onClick={() => setShowRunModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
