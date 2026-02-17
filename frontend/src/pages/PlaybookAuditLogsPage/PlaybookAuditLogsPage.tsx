/**
 * PlaybookAuditLogsPage Component - Enhanced UI/UX Version
 * View audit logs for all playbooks with advanced features
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Eye, RefreshCw, Grid, List, Clock, FileText, 
  Filter, Calendar, Activity, TrendingUp, BarChart3, 
  CheckCircle, XCircle, Package, History, AlertCircle,
  Download, SortAsc, Folder, Zap
} from 'lucide-react';
import { playbooksApi } from '../../api/api';
import type { Playbook } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { getUserTimezone } from '../../utils/timezone';

type ViewMode = 'card' | 'table' | 'timeline';
type FilterStatus = 'all' | 'active' | 'deleted';
type SortOption = 'name' | 'recent' | 'oldest';

export const PlaybookAuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showStats, setShowStats] = useState(true);

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

  const handleRefresh = async () => {
    await loadPlaybooks();
    addNotification('success', 'Playbooks refreshed');
  };

  // Statistics
  const stats = useMemo(() => {
    const active = playbooks.filter(p => p.is_active).length;
    const deleted = playbooks.filter(p => !p.is_active).length;
    const recentlyUpdated = playbooks.filter(p => {
      const daysDiff = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length;
    const folders = playbooks.filter(p => p.is_folder).length;

    return {
      total: playbooks.length,
      active,
      deleted,
      recentlyUpdated,
      folders,
      files: playbooks.length - folders
    };
  }, [playbooks]);

  // Filtering and Sorting
  const filteredPlaybooks = useMemo(() => {
    let filtered = playbooks.filter((playbook) => {
      const matchesSearch = playbook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           playbook.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = true;
      if (filterStatus === 'active') matchesStatus = playbook.is_active;
      if (filterStatus === 'deleted') matchesStatus = !playbook.is_active;
      
      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [playbooks, searchTerm, filterStatus, sortBy]);

  const getTimeSince = (date: string): string => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'just now';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-3" />
          <div className="text-gray-600 dark:text-gray-400 font-medium">Loading audit logs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Left Sidebar - Statistics */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg p-6 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <History className="h-5 w-5 text-primary-500" />
            Audit Overview
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Track all playbook changes</p>
        </div>

        {/* Quick Stats */}
        {showStats && (
          <div className="space-y-4 mb-6">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statistics</h4>
            
            {/* Total Playbooks */}
            <div className="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800 shadow-glow-sm">
              <div className="flex items-center justify-between mb-2">
                <Package className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Playbooks</div>
            </div>

            {/* Active vs Deleted */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mb-2" />
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mb-2" />
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.deleted}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Deleted</div>
              </div>
            </div>

            {/* Files vs Folders */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-2" />
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.files}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Files</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                <Folder className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mb-2" />
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.folders}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Folders</div>
              </div>
            </div>

            {/* Recently Updated */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.recentlyUpdated}</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Updated in last 7 days</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filters</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <div className="space-y-2">
              {(['all', 'active', 'deleted'] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filterStatus === status
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="capitalize">{status}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    filterStatus === status
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {status === 'all' ? stats.total : status === 'active' ? stats.active : stats.deleted}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Playbook Audit Logs
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {filteredPlaybooks.length} playbook{filteredPlaybooks.length !== 1 ? 's' : ''} • View change history and track modifications
              </p>
            </div>

            {/* View Mode & Sort */}
            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none px-4 py-2.5 pr-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow-sm hover:shadow-glow cursor-pointer font-medium"
                >
                  <option value="recent">Recently Updated</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                </select>
                <SortAsc className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* View Toggle */}
              <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow-sm p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'card'
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Card View"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'table'
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'timeline'
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Timeline View"
                >
                  <Activity className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by playbook name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500 shadow-glow-sm focus:shadow-glow transition-all duration-200 font-medium"
              />
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-glow-sm hover:shadow-glow disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Views */}
        {viewMode === 'card' ? (
          // Card View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlaybooks.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <History className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No playbooks found</p>
                <p className="text-gray-500 dark:text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredPlaybooks.map((playbook) => (
                <div
                  key={playbook.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-glow hover:shadow-glow-lg transition-all duration-300 overflow-hidden group hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {playbook.is_folder ? (
                          <Folder className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-500" />
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          playbook.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {playbook.is_active ? 'Active' : 'Deleted'}
                        </span>
                      </div>
                      <History className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {playbook.name}
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
                      {playbook.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                          <Clock className="h-3 w-3" />
                          <span>Created</span>
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {getTimeSince(playbook.created_at)}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                          <Activity className="h-3 w-3" />
                          <span>Updated</span>
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {getTimeSince(playbook.updated_at)}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all duration-200 shadow-glow-sm hover:shadow-glow font-semibold transform hover:scale-105"
                    >
                      <Eye className="h-4 w-4" />
                      View Audit History
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'timeline' ? (
          // Timeline View
          <div className="max-w-4xl mx-auto">
            {filteredPlaybooks.length === 0 ? (
              <div className="text-center py-16">
                <History className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No playbooks found</p>
                <p className="text-gray-500 dark:text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 via-primary-400 to-primary-300"></div>
                
                <div className="space-y-8">
                  {filteredPlaybooks.map((playbook, index) => (
                    <div key={playbook.id} className="relative flex gap-6">
                      {/* Timeline Dot */}
                      <div className="relative z-10">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-glow ${
                          playbook.is_active
                            ? 'bg-gradient-to-br from-green-400 to-green-600'
                            : 'bg-gradient-to-br from-red-400 to-red-600'
                        }`}>
                          {playbook.is_folder ? (
                            <Folder className="h-7 w-7 text-white" />
                          ) : (
                            <FileText className="h-7 w-7 text-white" />
                          )}
                        </div>
                      </div>

                      {/* Timeline Content */}
                      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-glow hover:shadow-glow-lg transition-all duration-300 p-6 group">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {playbook.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {playbook.description || 'No description'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            playbook.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {playbook.is_active ? 'Active' : 'Deleted'}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400 mb-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Created {getTimeSince(playbook.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            <span>Updated {getTimeSince(playbook.updated_at)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                          className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg inline-flex items-center gap-2 transition-all duration-200 shadow-glow-sm hover:shadow-glow font-semibold"
                        >
                          <Eye className="h-4 w-4" />
                          View Audit History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Table View
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-glow rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Playbook
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Timeline
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPlaybooks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">No playbooks found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPlaybooks.map((playbook) => (
                      <tr key={playbook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {playbook.is_folder ? (
                              <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                            ) : (
                              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            )}
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">{playbook.name}</div>
                              {playbook.is_folder && (
                                <span className="text-xs text-gray-500">Folder • {playbook.file_count || 0} files</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700 dark:text-gray-300 max-w-md truncate">
                            {playbook.description || 'No description'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            playbook.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {playbook.is_active ? '● Active' : '● Deleted'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              <span>Created {getTimeSince(playbook.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Activity className="h-3 w-3" />
                              <span>Updated {getTimeSince(playbook.updated_at)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg inline-flex items-center gap-2 transition-all shadow-glow-sm hover:shadow-glow font-medium text-sm"
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
        )}
      </div>
    </div>
  );
};
