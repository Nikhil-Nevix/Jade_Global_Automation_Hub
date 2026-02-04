/**
 * MultiServerExecutionModal Component
 * Modal for executing playbooks on multiple servers
 */

import React, { useState, useEffect } from 'react';
import { X, Play, Server as ServerIcon, AlertCircle, Settings } from 'lucide-react';
import { serversApi, jobsApi } from '../../api/api';
import { useUIStore } from '../../store/uiStore';
import type { Server, Playbook, ExecutionStrategy, BatchJobCreateRequest } from '../../types';
import { useNavigate } from 'react-router-dom';

interface MultiServerExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  playbook: Playbook | null;
}

export const MultiServerExecutionModal: React.FC<MultiServerExecutionModalProps> = ({
  isOpen,
  onClose,
  playbook,
}) => {
  const { addNotification } = useUIStore();
  const navigate = useNavigate();

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  // Selection state
  const [selectedServerIds, setSelectedServerIds] = useState<number[]>([]);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Execution config
  const [executionStrategy, setExecutionStrategy] = useState<ExecutionStrategy>('parallel');
  const [concurrentLimit, setConcurrentLimit] = useState(5);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load servers
  useEffect(() => {
    if (isOpen) {
      loadServers();
    }
  }, [isOpen]);

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await serversApi.list({ per_page: 100 });
      setServers(response.items.filter(s => s.is_active));
    } catch (error) {
      console.error('Failed to load servers:', error);
      addNotification('error', 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  // Get unique tags from all servers
  const allTags = Array.from(
    new Set(
      servers.flatMap(s => s.tags || [])
    )
  ).sort();

  // Filter servers
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ip_address.includes(searchTerm);
    
    const matchesTag = 
      filterTag === 'all' || 
      (server.tags && server.tags.includes(filterTag));
    
    return matchesSearch && matchesTag;
  });

  const handleToggleServer = (serverId: number) => {
    setSelectedServerIds(prev =>
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const handleSelectAll = () => {
    if (selectedServerIds.length === filteredServers.length) {
      setSelectedServerIds([]);
    } else {
      setSelectedServerIds(filteredServers.map(s => s.id));
    }
  };

  const handleSelectByTag = (tag: string) => {
    const serversWithTag = servers.filter(s => s.tags && s.tags.includes(tag));
    const tagServerIds = serversWithTag.map(s => s.id);
    setSelectedServerIds(prev => {
      const newSet = new Set([...prev, ...tagServerIds]);
      return Array.from(newSet);
    });
  };

  const handleExecute = async () => {
    if (!playbook) return;
    
    if (selectedServerIds.length < 2) {
      addNotification('error', 'Please select at least 2 servers for batch execution');
      return;
    }

    try {
      setExecuting(true);
      
      const batchJobData: BatchJobCreateRequest = {
        playbook_id: playbook.id,
        server_ids: selectedServerIds,
        concurrent_limit: executionStrategy === 'parallel' ? concurrentLimit : 1,
        stop_on_failure: stopOnFailure,
        execution_strategy: executionStrategy,
      };

      const result = await jobsApi.createBatch(batchJobData);
      
      addNotification('success', `Batch job created! Executing on ${selectedServerIds.length} servers.`);
      onClose();
      
      // Navigate to the batch job details page
      navigate(`/jobs/${result.id}`);
    } catch (error: any) {
      console.error('Failed to create batch job:', error);
      addNotification('error', error.response?.data?.message || 'Failed to create batch job');
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Play className="h-6 w-6" />
              Execute on Multiple Servers
            </h2>
            <p className="text-primary-100 text-sm mt-1">
              Playbook: <span className="font-semibold">{playbook?.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Filters */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by hostname or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Quick selection by tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600 font-medium">Quick select:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleSelectByTag(tag)}
                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm hover:bg-primary-200 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}

          {/* Server List */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedServerIds.length === filteredServers.length && filteredServers.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedServerIds.length} selected)
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {filteredServers.length} servers
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading servers...</div>
              ) : filteredServers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No servers found</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredServers.map(server => (
                    <label
                      key={server.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServerIds.includes(server.id)}
                        onChange={() => handleToggleServer(server.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <ServerIcon className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{server.hostname}</div>
                        <div className="text-sm text-gray-500">{server.ip_address}</div>
                      </div>
                      {server.tags && server.tags.length > 0 && (
                        <div className="flex gap-1">
                          {server.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {server.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{server.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Configuration */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-700">Advanced Configuration</span>
              </div>
              <span className="text-gray-500">{showAdvanced ? '−' : '+'}</span>
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4">
                {/* Execution Strategy */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Execution Strategy
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={executionStrategy === 'parallel'}
                        onChange={() => setExecutionStrategy('parallel')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Parallel</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={executionStrategy === 'sequential'}
                        onChange={() => setExecutionStrategy('sequential')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Sequential</span>
                    </label>
                  </div>
                </div>

                {/* Concurrent Limit (only for parallel) */}
                {executionStrategy === 'parallel' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Concurrent Servers: {concurrentLimit}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={concurrentLimit}
                      onChange={(e) => setConcurrentLimit(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1</span>
                      <span>20</span>
                    </div>
                  </div>
                )}

                {/* Stop on Failure */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stopOnFailure}
                      onChange={(e) => setStopOnFailure(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Stop all executions if one fails</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          {selectedServerIds.length > 10 && (
            <div className="flex gap-3 p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-warning-800">
                You're about to execute this playbook on <strong>{selectedServerIds.length} servers</strong>. 
                Please ensure this is intentional.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedServerIds.length} server{selectedServerIds.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={executing}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={selectedServerIds.length < 2 || executing}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play className="h-5 w-5" />
              {executing ? 'Executing...' : 'Execute Batch Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
