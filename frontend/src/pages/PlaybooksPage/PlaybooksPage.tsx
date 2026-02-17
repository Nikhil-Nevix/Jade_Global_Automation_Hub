/**
 * PlaybooksPage Component - Enhanced UI/UX Version
 * Manage Ansible playbooks with advanced features
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Search, Upload, Trash2, Play, RefreshCw, X, UploadCloud, Edit, Save, 
  Grid, List, Copy, Clock, FileText, History, Server as ServerIcon, 
  Folder, Download, Package, Star, TrendingUp, Activity, Eye, Zap, 
  Filter, SortAsc, Tag, Calendar, BarChart3, Users, CheckCircle, AlertCircle, AlertTriangle
} from 'lucide-react';
import { playbooksApi, serversApi, jobsApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import type { Playbook, Server } from '../../types';
import { MultiServerExecutionModal } from '../../components/MultiServerExecutionModal';
import { UploadPlaybookModal } from '../../components/UploadPlaybookModal';
import { FolderEditModal } from '../../components/FolderEditModal';
import { getUserTimezone } from '../../utils/timezone';

type ViewMode = 'card' | 'table';
type Category = 'all' | 'favorites' | 'maintenance' | 'web-server' | 'deployment' | 'database' | 'security';
type SortOption = 'name' | 'recent' | 'popular' | 'duration';

export const PlaybooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [playbookDurations, setPlaybookDurations] = useState<Record<number, string>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showMultiServerModal, setShowMultiServerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFolderEditModal, setShowFolderEditModal] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingContent, setSavingContent] = useState(false);

  // Enhanced UI state
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const [playbookStats, setPlaybookStats] = useState<Record<number, { runs: number, lastRun: string | null }>>({});
  const [isDragging, setIsDragging] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    loadData();
    
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('playbook_favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  useEffect(() => {
    // Calculate durations and stats for all playbooks
    const fetchDurationsAndStats = async () => {
      const durations: Record<number, string> = {};
      const stats: Record<number, { runs: number, lastRun: string | null }> = {};
      
      for (const playbook of playbooks) {
        try {
          const jobs = await jobsApi.list({ playbook_id: playbook.id, per_page: 10 });
          
          // Stats
          stats[playbook.id] = {
            runs: jobs.total || jobs.items.length,
            lastRun: jobs.items[0]?.created_at || null
          };
          
          // Duration
          if (jobs.items.length > 0) {
            const completedJobs = jobs.items.filter(j => j.completed_at && j.started_at);
            if (completedJobs.length > 0) {
              const totalSeconds = completedJobs.reduce((sum, job) => {
                const start = new Date(job.started_at!).getTime();
                const end = new Date(job.completed_at!).getTime();
                return sum + (end - start) / 1000;
              }, 0);
              const avgSeconds = totalSeconds / completedJobs.length;
              durations[playbook.id] = formatDuration(avgSeconds);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch data for playbook ${playbook.id}`);
        }
      }
      setPlaybookDurations(durations);
      setPlaybookStats(stats);
    };

    if (playbooks.length > 0) {
      fetchDurationsAndStats();
    }
  }, [playbooks]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  const getCategoryFromPlaybook = (playbook: Playbook): Category => {
    if (!playbook || !playbook.name) return 'all';
    
    const name = playbook.name.toLowerCase();
    const desc = playbook.description?.toLowerCase() || '';
    const combined = name + ' ' + desc;
    
    if (combined.includes('maintenance') || combined.includes('update') || combined.includes('package')) return 'maintenance';
    if (combined.includes('nginx') || combined.includes('apache') || combined.includes('web')) return 'web-server';
    if (combined.includes('deploy') || combined.includes('app') || combined.includes('release')) return 'deployment';
    if (combined.includes('database') || combined.includes('mysql') || combined.includes('postgres') || combined.includes('backup')) return 'database';
    if (combined.includes('security') || combined.includes('harden') || combined.includes('firewall')) return 'security';
    
    return 'all';
  };

  const categories = [
    { id: 'all' as Category, name: 'All Playbooks', icon: Package, count: playbooks.length },
    { id: 'favorites' as Category, name: 'Favorites', icon: Star, count: playbooks.filter(p => favorites.has(p.id)).length },
    { id: 'maintenance' as Category, name: 'Maintenance', icon: Activity, count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'maintenance').length },
    { id: 'web-server' as Category, name: 'Web Server', icon: ServerIcon, count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'web-server').length },
    { id: 'deployment' as Category, name: 'Deployment', icon: Zap, count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'deployment').length },
    { id: 'database' as Category, name: 'Database', icon: BarChart3, count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'database').length },
    { id: 'security' as Category, name: 'Security', icon: CheckCircle, count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'security').length },
  ];

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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this playbook?')) {
      return;
    }

    try {
      setPlaybooks(prevPlaybooks => prevPlaybooks.filter(p => p.id !== id));
      await playbooksApi.delete(id);
      addNotification('success', 'Playbook deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete playbook:', error);
      addNotification('error', error.response?.data?.error || 'Delete failed');
      loadData();
    }
  };

  const handleDownload = async (playbook: Playbook) => {
    if (!playbook.is_folder) {
      addNotification('info', 'Download is only available for folder playbooks');
      return;
    }

    try {
      const blob = await playbooksApi.downloadFolder(playbook.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${playbook.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addNotification('success', 'Playbook downloaded successfully');
    } catch (error: any) {
      console.error('Failed to download playbook:', error);
      addNotification('error', error.response?.data?.message || 'Download failed');
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
      setSelectedServerId(null);
      setSelectedPlaybook(null);
      navigate(`/jobs/${job.id}`);
    } catch (error: any) {
      console.error('Failed to create job:', error);
      addNotification('error', error.response?.data?.error || 'Failed to create job');
    }
  };

  const handleEdit = async (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    
    if (playbook.is_folder) {
      setShowFolderEditModal(true);
      return;
    }
    
    setShowEditModal(true);
    setLoadingContent(true);
    
    try {
      const response = await playbooksApi.getContent(playbook.id);
      setEditContent(response.content);
    } catch (error: any) {
      console.error('Failed to load playbook content:', error);
      addNotification('error', error.response?.data?.message || 'Failed to load playbook content');
      setShowEditModal(false);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedPlaybook) return;

    if (!editContent.trim()) {
      addNotification('error', 'Playbook content cannot be empty');
      return;
    }

    setSavingContent(true);
    try {
      await playbooksApi.updateContent(selectedPlaybook.id, editContent);
      addNotification('success', 'Playbook updated successfully');
      setShowEditModal(false);
      setEditContent('');
      setSelectedPlaybook(null);
      loadData();
    } catch (error: any) {
      console.error('Failed to update playbook:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update playbook';
      addNotification('error', errorMessage);
    } finally {
      setSavingContent(false);
    }
  };

  const toggleFavorite = useCallback((id: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    // Check current state before updating
    const isCurrentlyFavorite = favorites.has(id);
    
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      localStorage.setItem('playbook_favorites', JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
    
    // Show notification after state update (outside the setter)
    addNotification('success', isCurrentlyFavorite ? 'Removed from favorites' : 'Added to favorites');
  }, [favorites, addNotification]);

  const handleQuickPreview = async (playbook: Playbook) => {
    if (playbook.is_folder) {
      addNotification('info', 'Preview is not available for folder playbooks');
      return;
    }
    
    setSelectedPlaybook(playbook);
    setShowPreviewModal(true);
    setLoadingPreview(true);
    
    try {
      const response = await playbooksApi.getContent(playbook.id);
      setPreviewContent(response.content);
    } catch (error: any) {
      console.error('Failed to load preview:', error);
      addNotification('error', 'Failed to load preview');
      setShowPreviewModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isAdmin) {
      setIsDragging(true);
    }
  }, [isAdmin]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!isAdmin) return;
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const fileName = file.name.toLowerCase();
      
      if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml') && !fileName.endsWith('.zip')) {
        addNotification('error', 'Please drop a YAML file (.yml/.yaml) or ZIP folder');
        return;
      }
      
      const maxSizeInBytes = 500 * 1024;
      if (file.size > maxSizeInBytes) {
        addNotification('error', `File size exceeds 500 KB limit`);
        return;
      }
      
      setShowUploadModal(true);
    }
  }, [isAdmin, addNotification]);

  const sortPlaybooks = useCallback((playbooksToSort: Playbook[]) => {
    const sorted = [...playbooksToSort];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'recent':
        return sorted.sort((a, b) => {
          const aTime = playbookStats[a.id]?.lastRun || a.updated_at;
          const bTime = playbookStats[b.id]?.lastRun || b.updated_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      case 'popular':
        return sorted.sort((a, b) => {
          const aRuns = playbookStats[a.id]?.runs || 0;
          const bRuns = playbookStats[b.id]?.runs || 0;
          return bRuns - aRuns;
        });
      case 'duration':
        return sorted.sort((a, b) => {
          const aDur = playbookDurations[a.id] || 'zzz';
          const bDur = playbookDurations[b.id] || 'zzz';
          return aDur.localeCompare(bDur);
        });
      default:
        return sorted;
    }
  }, [sortBy, playbookStats, playbookDurations]);

  const filteredPlaybooks = useMemo(() => {
    let filtered = playbooks.filter((playbook) => {
      const matchesSearch = playbook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           playbook.description?.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesCategory = true;
      
      if (selectedCategory === 'favorites') {
        matchesCategory = favorites.has(playbook.id);
      } else if (selectedCategory !== 'all') {
        matchesCategory = getCategoryFromPlaybook(playbook) === selectedCategory;
      }
      
      return matchesSearch && matchesCategory;
    });
    
    return sortPlaybooks(filtered);
  }, [playbooks, searchTerm, selectedCategory, favorites, sortPlaybooks]);

  const handleCopyPlaybook = (playbook: Playbook) => {
    navigator.clipboard.writeText(playbook.file_path);
    addNotification('success', 'File path copied to clipboard');
  };

  const getCategoryColor = (category: Category) => {
    const colors = {
      'all': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      'favorites': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'maintenance': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'web-server': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'deployment': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'database': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'security': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[category] || colors['all'];
  };

  const getCategoryBadgeColor = (playbook: Playbook) => {
    const category = getCategoryFromPlaybook(playbook);
    return getCategoryColor(category);
  };

  // Calculate statistics
  const totalPlaybooks = playbooks.length;
  const favoritePlaybooks = playbooks.filter(p => favorites.has(p.id)).length;
  const totalExecutions = Object.values(playbookStats).reduce((sum, stat) => sum + stat.runs, 0);
  const recentlyUpdated = playbooks.filter(p => {
    const daysDiff = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-3" />
          <div className="text-gray-600 dark:text-gray-400 font-medium">Loading playbooks...</div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Drag and drop overlay */}
      {isDragging && isAdmin && (
        <div className="fixed inset-0 bg-primary-500 bg-opacity-20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12 border-4 border-dashed border-primary-500 animate-pulse">
            <UploadCloud className="h-24 w-24 text-primary-500 mx-auto mb-4" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white text-center">Drop your playbook here</p>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-center">YAML or ZIP files supported (max 500 KB)</p>
          </div>
        </div>
      )}

      {/* Categories Sidebar */}
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg p-6 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary-500" />
            Playbook Library
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Browse & manage playbooks</p>
        </div>

        {/* Quick Stats */}
        {showStatsPanel && (
          <div className="mb-6 p-4 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl border border-primary-200 dark:border-primary-800 shadow-glow-sm">
            <h4 className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-3">Quick Stats</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPlaybooks}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{favoritePlaybooks}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Favorites</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalExecutions}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Runs</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{recentlyUpdated}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Updated</div>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Categories</h4>
          <nav className="space-y-2">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedCategory === category.id
                      ? 'bg-primary-500 text-white shadow-glow transform scale-105'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-glow-sm'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${selectedCategory === category.id ? 'text-white' : 'text-gray-400'}`} />
                    {category.name}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedCategory === category.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {category.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {selectedCategory === 'all' ? 'All Playbooks' : 
                 selectedCategory === 'favorites' ? 'Favorite Playbooks' :
                 categories.find(c => c.id === selectedCategory)?.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {filteredPlaybooks.length} playbook{filteredPlaybooks.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            {/* View Toggle & Actions */}
            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none px-4 py-2.5 pr-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow-sm hover:shadow-glow cursor-pointer font-medium"
                >
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Popular</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="duration">Duration</option>
                </select>
                <SortAsc className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* View Mode Toggle */}
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
              </div>
            </div>
          </div>

          {/* Search and Actions Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search playbooks by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500 shadow-glow-sm focus:shadow-glow transition-all duration-200 font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            
            {/* Upload button */}
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-200 shadow-glow hover:shadow-glow-lg transform hover:scale-105 font-semibold whitespace-nowrap"
              >
                <Upload className="h-5 w-5" />
                Upload Playbook
              </button>
            )}
            
            <button
              onClick={loadData}
              disabled={loading}
              className="p-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-glow-sm hover:shadow-glow disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Playbooks Content */}
        {viewMode === 'card' ? (
          // Enhanced Card View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlaybooks.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No playbooks found</p>
                <p className="text-gray-500 dark:text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredPlaybooks.map((playbook) => {
                const category = getCategoryFromPlaybook(playbook);
                const duration = playbookDurations[playbook.id];
                const stats = playbookStats[playbook.id];
                const isFavorite = favorites.has(playbook.id);
                
                return (
                  <div
                    key={playbook.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-glow hover:shadow-glow-lg transition-all duration-300 overflow-hidden group hover:-translate-y-1"
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryBadgeColor(category)}`}>
                            {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </span>
                          {playbook.is_folder && (
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {playbook.file_count || 0}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => toggleFavorite(playbook.id, e)}
                          className={`p-1.5 rounded-lg transition-all duration-200 ${
                            isFavorite 
                              ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' 
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                          }`}
                          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {playbook.is_folder ? (
                          <Folder className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{playbook.name}</span>
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
                        {playbook.description || 'No description provided'}
                      </p>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        {duration && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">{duration}</span>
                          </div>
                        )}
                        {stats && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Activity className="h-4 w-4" />
                            <span className="font-medium">{stats.runs} runs</span>
                          </div>
                        )}
                        {stats?.lastRun && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 ml-auto">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{new Date(stats.lastRun).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-2 mb-2">
                        {/* Primary Actions */}
                        <button
                          onClick={() => handleRun(playbook)}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all duration-200 shadow-glow-sm hover:shadow-glow font-semibold transform hover:scale-105"
                        >
                          <Play className="h-4 w-4" />
                          Run
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedPlaybook(playbook);
                            setShowMultiServerModal(true);
                          }}
                          className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all duration-200 shadow-glow-sm hover:shadow-glow font-semibold"
                          title="Execute on multiple servers"
                        >
                          <ServerIcon className="h-4 w-4" />
                          Multi
                        </button>

                        {/* Quick Preview */}
                        {!playbook.is_folder && (
                          <button
                            onClick={() => handleQuickPreview(playbook)}
                            className="p-2.5 bg-info-500 hover:bg-info-600 text-white rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow"
                            title="Quick Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        {/* Download for folders */}
                        {playbook.is_folder && (
                          <button
                            onClick={() => handleDownload(playbook)}
                            className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow"
                            title="Download as ZIP"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                            className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow text-sm font-medium flex items-center justify-center gap-1.5"
                            title="View History"
                          >
                            <History className="h-4 w-4" />
                            History
                          </button>
                          
                          <button
                            onClick={() => handleEdit(playbook)}
                            className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow text-sm font-medium flex items-center justify-center gap-1.5"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          
                          <button
                            onClick={() => handleDelete(playbook.id)}
                            className="p-2 bg-error-500 hover:bg-error-600 text-white rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {isSuperAdmin && (
                            <button
                              onClick={() => handleCopyPlaybook(playbook)}
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 shadow-glow-sm hover:shadow-glow"
                              title="Copy Path"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Table View (keeping original for now)
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-glow rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Stats
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Updated
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
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">No playbooks found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPlaybooks.map((playbook) => {
                      const stats = playbookStats[playbook.id];
                      const duration = playbookDurations[playbook.id];
                      const isFavorite = favorites.has(playbook.id);
                      
                      return (
                        <tr key={playbook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => toggleFavorite(playbook.id, e)}
                                className={`transition-colors ${
                                  isFavorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                                }`}
                              >
                                <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                              </button>
                              {playbook.is_folder ? (
                                <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                              ) : (
                                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">{playbook.name}</div>
                                {playbook.is_folder && (
                                  <span className="text-xs text-gray-500">{playbook.file_count || 0} files</span>
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
                            <div className="flex flex-col gap-1">
                              {stats && (
                                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {stats.runs} runs
                                </span>
                              )}
                              {duration && (
                                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {duration} avg
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              {new Date(playbook.updated_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRun(playbook)}
                                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg inline-flex items-center gap-1 transition-all shadow-glow-sm hover:shadow-glow font-medium"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Run
                              </button>
                              {!playbook.is_folder && (
                                <button
                                  onClick={() => handleQuickPreview(playbook)}
                                  className="p-1.5 bg-info-500 hover:bg-info-600 text-white rounded-lg transition-all shadow-glow-sm hover:shadow-glow"
                                  title="Quick Preview"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleEdit(playbook)}
                                    className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                                    title="Edit"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(playbook.id)}
                                    className="p-1.5 bg-error-500 hover:bg-error-600 text-white rounded-lg transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Upload Modal */}
      <UploadPlaybookModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          loadData();
          addNotification('success', 'Playbook uploaded successfully');
        }}
        onError={(message) => addNotification('error', message)}
      />

      {/* Run Modal */}
      {showRunModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 shadow-2xl rounded-2xl max-w-lg w-full mx-4 overflow-hidden animate-slideIn">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Play className="h-6 w-6 text-primary-600" />
                Run Playbook
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedPlaybook.name}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select Target Server *
                </label>
                <select
                  value={selectedServerId || ''}
                  onChange={(e) => setSelectedServerId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-glow-sm transition-all font-medium"
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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow hover:shadow-glow-lg font-semibold"
                >
                  Execute Now
                </button>
                <button
                  onClick={() => {
                    setShowRunModal(false);
                    setSelectedServerId(null);
                  }}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal */}
      {showPreviewModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-slideIn">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Eye className="h-6 w-6 text-primary-600" />
                  Quick Preview
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedPlaybook.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewContent('');
                  setSelectedPlaybook(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-auto">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 text-primary-500 animate-spin" />
                </div>
              ) : (
                <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-auto font-mono text-sm whitespace-pre-wrap shadow-inner">
                  {previewContent}
                </pre>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleEdit(selectedPlaybook);
                  }}
                  className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all duration-200 font-semibold flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Playbook
                </button>
              )}
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewContent('');
                  setSelectedPlaybook(null);
                }}
                className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playbook Modal */}
      {showEditModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 shadow-2xl rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-slideIn">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Edit className="h-6 w-6 text-primary-600" />
                  Edit Playbook
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedPlaybook.file_path}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditContent('');
                  setSelectedPlaybook(null);
                }}
                disabled={savingContent}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
              {loadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <RefreshCw className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                    <div className="text-gray-600 dark:text-gray-400">Loading content...</div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    YAML Content
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 w-full px-4 py-3 bg-gray-900 text-gray-100 font-mono text-sm rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none shadow-inner"
                    style={{ minHeight: '500px' }}
                    spellCheck={false}
                  />
                  <div className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    Ensure your YAML syntax is correct before saving
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-500" />
                Changes will be saved immediately
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditContent('');
                    setSelectedPlaybook(null);
                  }}
                  disabled={savingContent}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContent}
                  disabled={savingContent || loadingContent}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingContent ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Edit Modal */}
      {showFolderEditModal && selectedPlaybook && (
        <FolderEditModal
          playbook={selectedPlaybook}
          onClose={() => {
            setShowFolderEditModal(false);
            setSelectedPlaybook(null);
          }}
          onSave={() => {
            loadData();
          }}
        />
      )}

      {/* Multi-Server Execution Modal */}
      <MultiServerExecutionModal
        isOpen={showMultiServerModal}
        onClose={() => {
          setShowMultiServerModal(false);
          setSelectedPlaybook(null);
        }}
        playbook={selectedPlaybook}
      />
    </>
  );
};
