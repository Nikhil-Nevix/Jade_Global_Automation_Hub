/**
 * PlaybookAuditLogsPage Component
 * View audit logs for all playbooks
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, RefreshCw } from 'lucide-react';
import { playbooksApi } from '../../api/api';
import type { Playbook } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { getUserTimezone } from '../../utils/timezone';

export const PlaybookAuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    try {
      setLoading(true);
      const response = await playbooksApi.list({ per_page: 100 });
      setPlaybooks(response.items);
    } catch (error) {
      console.error('Failed to load playbooks:', error);
      addNotification('error', 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const filteredPlaybooks = playbooks.filter((playbook) =>
    playbook.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Playbook Audit Logs</h2>
        <p className="text-gray-600 mt-1">View change history for all playbooks</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search playbooks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          title="Refresh playbooks"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Playbooks Table */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Playbook Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-600">
                  Loading playbooks...
                </td>
              </tr>
            ) : filteredPlaybooks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-600">
                  No playbooks found
                </td>
              </tr>
            ) : (
              filteredPlaybooks.map((playbook) => (
                <tr key={playbook.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{playbook.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-700">
                      {playbook.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {playbook.is_active ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Deleted
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span>{new Intl.DateTimeFormat('en-US', {
                        timeZone: getUserTimezone(),
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }).format(new Date(playbook.created_at))}</span>
                      <span className="text-xs text-gray-600">{new Date(playbook.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View History
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
