/**
 * PlaybooksPage Component
 * Manage Ansible playbooks with upload and CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { Search, Upload, Trash2, Play, RefreshCw, X, UploadCloud, Edit, Save, Grid, List, Copy, Clock, FileText, History, Server as ServerIcon, Folder, Download, Package } from 'lucide-react';
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
type Category = 'all' | 'maintenance' | 'web-server' | 'deployment' | 'database' | 'security';

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
  const [uploadData, setUploadData] = useState({
    file: null as File | null,
    name: '',
    description: '',
  });

  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Calculate durations for all playbooks
    const fetchDurations = async () => {
      const durations: Record<number, string> = {};
      for (const playbook of playbooks) {
        try {
          const jobs = await jobsApi.list({ playbook_id: playbook.id, per_page: 10 });
          if (jobs.items.length > 0) {
            // Calculate average duration from recent jobs
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
          console.error(`Failed to fetch duration for playbook ${playbook.id}`);
        }
      }
      setPlaybookDurations(durations);
    };

    if (playbooks.length > 0) {
      fetchDurations();
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
    { id: 'all' as Category, name: 'All', count: playbooks.length },
    { id: 'maintenance' as Category, name: 'Maintenance', count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'maintenance').length },
    { id: 'web-server' as Category, name: 'Web Server', count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'web-server').length },
    { id: 'deployment' as Category, name: 'Deployment', count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'deployment').length },
    { id: 'database' as Category, name: 'Database', count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'database').length },
    { id: 'security' as Category, name: 'Security', count: playbooks.filter(p => getCategoryFromPlaybook(p) === 'security').length },
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File change event triggered', e.target.files);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
        addNotification('error', 'Invalid file type. Please upload a YAML file (.yml or .yaml)');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Validate file size (max 500 KB = 512,000 bytes)
      const maxSizeInBytes = 500 * 1024; // 500 KB
      if (file.size > maxSizeInBytes) {
        addNotification('error', `File size exceeds 500 KB limit. Your file is ${(file.size / 1024).toFixed(2)} KB`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      console.log('File validation passed, updating state');
      setUploadData({
        ...uploadData,
        file,
        name: uploadData.name || file.name.replace('.yml', '').replace('.yaml', ''),
      });
      
      addNotification('success', `File "${file.name}" selected (${(file.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log('No file selected');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate file is selected
    if (!uploadData.file) {
      addNotification('error', 'Please select a file');
      return;
    }
    
    // Validate playbook name
    if (!uploadData.name || uploadData.name.trim() === '') {
      addNotification('error', 'Please enter a playbook name');
      return;
    }
    
    // Re-validate file type (in case of manual form manipulation)
    const fileName = uploadData.file.name.toLowerCase();
    if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
      addNotification('error', 'Invalid file type. Please upload a YAML file (.yml or .yaml)');
      return;
    }
    
    // Re-validate file size
    const maxSizeInBytes = 500 * 1024;
    if (uploadData.file.size > maxSizeInBytes) {
      addNotification('error', `File size exceeds 500 KB limit`);
      return;
    }

    try {
      await playbooksApi.upload(uploadData.file, uploadData.name, uploadData.description);
      addNotification('success', 'Playbook uploaded successfully');
      setShowUploadModal(false);
      setUploadData({ file: null, name: '', description: '' });
      loadData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Upload failed';
      addNotification('error', errorMessage);
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
      console.log('Creating job with:', { playbook_id: selectedPlaybook.id, server_id: selectedServerId });
      const job = await jobsApi.create({
        playbook_id: selectedPlaybook.id,
        server_id: selectedServerId,
      });
      console.log('Job created successfully:', job);
      addNotification('success', 'Job created successfully');
      setShowRunModal(false);
      setSelectedServerId(null);
      setSelectedPlaybook(null);
      // Navigate to job details page
      console.log('Navigating to job details:', `/jobs/${job.id}`);
      navigate(`/jobs/${job.id}`);
    } catch (error: any) {
      console.error('Failed to create job:', error);
      addNotification('error', error.response?.data?.error || 'Failed to create job');
    }
  };

  const handleEdit = async (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    
    // Check if it's a folder playbook
    if (playbook.is_folder) {
      setShowFolderEditModal(true);
      return;
    }
    
    // For single file playbooks
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

    // Basic YAML validation
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
      loadData(); // Reload playbooks to refresh updated_at timestamp
    } catch (error: any) {
      console.error('Failed to update playbook:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update playbook';
      addNotification('error', errorMessage);
    } finally {
      setSavingContent(false);
    }
  };

  const filteredPlaybooks = playbooks.filter((playbook) => {
    const matchesSearch = playbook.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || getCategoryFromPlaybook(playbook) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopyPlaybook = (playbook: Playbook) => {
    navigator.clipboard.writeText(playbook.file_path);
    addNotification('success', 'File path copied to clipboard');
  };

  const getCategoryColor = (category: Category) => {
    const colors = {
      'all': 'bg-gray-100 text-gray-700',
      'maintenance': 'bg-orange-100 text-orange-700',
      'web-server': 'bg-blue-100 text-blue-700',
      'deployment': 'bg-green-100 text-green-700',
      'database': 'bg-purple-100 text-purple-700',
      'security': 'bg-red-100 text-red-700',
    };
    return colors[category] || colors['all'];
  };

  const getCategoryBadgeColor = (playbook: Playbook) => {
    const category = getCategoryFromPlaybook(playbook);
    return getCategoryColor(category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading playbooks...</div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full">
      {/* Categories Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-glow-sm p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          📂 Categories
        </h3>
        <nav className="space-y-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all $  {
                selectedCategory === category.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-glow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>{category.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                selectedCategory === category.id
                  ? 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {category.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {/* Header with Search and Actions */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Playbooks</h2>
            
            {/* View Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow-sm p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'card'
                      ? 'bg-primary-500 text-white shadow-glow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Card View"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'table'
                      ? 'bg-primary-500 text-white shadow-glow-sm'
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
                placeholder="Filter by name or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500 shadow-glow-sm focus:shadow-glow transition-all"
              />
            </div>
            
            {/* Upload button - only for admin and super_admin */}
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-glow-sm hover:shadow-glow whitespace-nowrap"
              >
                <Upload className="h-5 w-5" />
                Upload YAML
              </button>
            )}
            
            <button
              onClick={loadData}
              className="p-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-glow-sm hover:shadow-glow"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Playbooks Content - Card or Table View */}
        {viewMode === 'card' ? (
          // Card View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlaybooks.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">No playbooks found</p>
              </div>
            ) : (
              filteredPlaybooks.map((playbook) => {
                const category = getCategoryFromPlaybook(playbook);
                const duration = playbookDurations[playbook.id];
                
                return (
                  <div
                    key={playbook.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow hover:shadow-glow-lg transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Header with Category Badge */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryBadgeColor(category)}`}>
                          {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </span>
                        {duration && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatDuration(duration)}</span>
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        {playbook.is_folder ? (
                          <>
                            <Folder className="h-5 w-5 text-yellow-500" />
                            <span>{playbook.name}</span>
                            <span className="text-sm text-gray-500 font-normal">
                              ({playbook.file_count || 0} files)
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-5 w-5 text-blue-500" />
                            <span>{playbook.name}</span>
                          </>
                        )}
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {playbook.description || 'No description provided'}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded">
                        {playbook.is_folder ? (
                          <>
                            <Package className="h-3.5 w-3.5" />
                            <span className="truncate" title={playbook.main_playbook_file}>
                              {playbook.main_playbook_file || 'site.yml'}
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            <span className="truncate" title={playbook.file_path}>
                              {playbook.file_path}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Footer with Actions */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-between gap-2">
                        {/* Run Button - All Users */}
                        <button
                          onClick={() => handleRun(playbook)}
                          className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-glow-sm hover:shadow-glow font-medium"
                        >
                          <Play className="h-4 w-4" />
                          Run
                        </button>
                        
                        {/* Multi-Server Execute Button - All Users */}
                        <button
                          onClick={() => {
                            setSelectedPlaybook(playbook);
                            setShowMultiServerModal(true);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-glow-sm hover:shadow-glow font-medium"
                          title="Execute on multiple servers"
                        >
                          <ServerIcon className="h-4 w-4" />
                          Multi
                        </button>

                        {/* Download Button - For folder playbooks */}
                        {playbook.is_folder && (
                          <button
                            onClick={() => handleDownload(playbook)}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-glow-sm hover:shadow-glow font-medium"
                            title="Download as ZIP"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Admin Actions */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                              className="p-2 bg-info-500 hover:bg-info-600 text-white rounded-lg transition-all shadow-glow-sm hover:shadow-glow"
                              title="View History"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            
                            <button
                              onClick={() => handleEdit(playbook)}
                              className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all shadow-glow-sm hover:shadow-glow"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            
                            <button
                              onClick={() => handleDelete(playbook.id)}
                              className="p-2 bg-error-500 hover:bg-error-600 text-white rounded-lg transition-all shadow-glow-sm hover:shadow-glow"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        
                        {/* Copy Button - Super Admin Only */}
                        {user?.role === 'super_admin' && (
                          <button
                            onClick={() => handleCopyPlaybook(playbook)}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all shadow-glow-sm hover:shadow-glow"
                            title="Copy Playbook"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Table View
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-glow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    File Path
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPlaybooks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                      No playbooks found
                    </td>
                  </tr>
                ) : (
                  filteredPlaybooks.map((playbook) => (
                    <tr key={playbook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {playbook.is_folder ? (
                            <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{playbook.name}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit mt-1 ${
                              playbook.is_folder 
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' 
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {playbook.is_folder ? 'Folder' : 'File'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {playbook.description || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-mono max-w-[200px] truncate" title={playbook.file_path}>
                          {playbook.file_path}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span>{new Intl.DateTimeFormat('en-US', {
                            timeZone: getUserTimezone(),
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }).format(new Date(playbook.created_at))}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-500">{new Intl.DateTimeFormat('en-US', {
                            timeZone: getUserTimezone(),
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }).format(new Date(playbook.created_at))}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span>{new Intl.DateTimeFormat('en-US', {
                            timeZone: getUserTimezone(),
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }).format(new Date(playbook.updated_at))}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-500">{new Intl.DateTimeFormat('en-US', {
                            timeZone: getUserTimezone(),
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }).format(new Date(playbook.updated_at))}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {/* Run button - visible for all users */}
                          <button
                            onClick={() => handleRun(playbook)}
                            className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-md inline-flex items-center gap-1 transition-all shadow-glow-sm hover:shadow-glow"
                          >
                            <Play className="h-4 w-4" />
                            Run
                          </button>
                          {/* Edit and Delete buttons - only for admin and super_admin */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => navigate(`/playbooks/${playbook.id}/audit`)}
                                className="px-3 py-1.5 bg-info-500 hover:bg-info-600 text-white rounded-md inline-flex items-center gap-1 transition-all shadow-glow-sm hover:shadow-glow"
                                title="View History"
                              >
                                <History className="h-4 w-4" />
                                History
                              </button>
                              <button
                                onClick={() => handleEdit(playbook)}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md inline-flex items-center gap-1 transition-all shadow-glow-sm hover:shadow-glow"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(playbook.id)}
                                className="px-3 py-1.5 bg-error-500 hover:bg-error-600 text-white rounded-md inline-flex items-center gap-1 transition-all shadow-glow-sm hover:shadow-glow"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {/* Upload Modal - New Component */}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Run Playbook: {selectedPlaybook.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Target Server *
                </label>
                <select
                  value={selectedServerId || ''}
                  onChange={(e) => setSelectedServerId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Execute
                </button>
                <button
                  onClick={() => setShowRunModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playbook Modal */}
      {showEditModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Edit Playbook: {selectedPlaybook.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPlaybook.file_path}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditContent('');
                  setSelectedPlaybook(null);
                }}
                disabled={savingContent}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 px-6 py-4 overflow-hidden">
              {loadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-600">Loading playbook content...</div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YAML Content
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 w-full px-4 py-3 bg-white text-gray-900 font-mono text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    style={{ minHeight: '500px' }}
                    spellCheck={false}
                  />
                  <div className="mt-2 text-xs text-gray-600">
                    💡 Tip: Make sure your YAML syntax is correct before saving
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                ⚠️ Changes will be saved immediately to the playbook file
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
                  className="px-6 py-2.5 text-gray-700 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContent}
                  disabled={savingContent || loadingContent}
                  className="px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingContent ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Commit Changes
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
            loadData(); // Reload playbooks to refresh updated_at timestamp
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
