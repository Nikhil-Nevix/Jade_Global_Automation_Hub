/**
 * FolderEditModal Component
 * Edit multiple files in a folder playbook with visual tree structure
 */

import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { playbooksApi } from '../api/api';
import { useUIStore } from '../store/uiStore';
import type { Playbook } from '../types';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface OpenFile {
  path: string;
  content: string;
  modified: boolean;
  originalContent: string;
}

interface FolderEditModalProps {
  playbook: Playbook;
  onClose: () => void;
  onSave: () => void;
}

export const FolderEditModal: React.FC<FolderEditModalProps> = ({ playbook, onClose, onSave }) => {
  const { addNotification } = useUIStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [folderStructure, setFolderStructure] = useState<FileNode | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFileList();
  }, [playbook.id]);

  const loadFileList = async () => {
    try {
      setLoading(true);
      const response = await playbooksApi.getFolderFiles(playbook.id);
      setFileList(response.files);
      
      // Build folder structure from file list
      const structure = buildFolderStructure(response.files);
      setFolderStructure(structure);
      
      // Auto-expand root folders
      const rootFolders = new Set<string>();
      response.files.forEach(file => {
        const parts = file.split('/');
        if (parts.length > 1) {
          rootFolders.add(parts[0]);
        }
      });
      setExpandedFolders(rootFolders);
    } catch (error: any) {
      console.error('Failed to load folder files:', error);
      addNotification('error', error.response?.data?.message || 'Failed to load folder structure');
    } finally {
      setLoading(false);
    }
  };

  const buildFolderStructure = (files: string[]): FileNode => {
    const root: FileNode = { name: 'root', path: '', type: 'folder', children: [] };
    
    files.forEach(filePath => {
      const parts = filePath.split('/');
      let currentNode = root;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        let childNode = currentNode.children?.find(child => child.name === part);
        
        if (!childNode) {
          childNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : []
          };
          currentNode.children = currentNode.children || [];
          currentNode.children.push(childNode);
        }
        
        if (!isFile) {
          currentNode = childNode;
        }
      });
    });
    
    return root;
  };

  const handleFileSelect = async (filePath: string) => {
    setSelectedFilePath(filePath);
    
    // Check if file is already open
    const existingIndex = openFiles.findIndex(f => f.path === filePath);
    if (existingIndex !== -1) {
      setActiveFileIndex(existingIndex);
      return;
    }
    
    // Load file content
    try {
      const response = await playbooksApi.getFolderFileContent(playbook.id, filePath);
      const newFile: OpenFile = {
        path: filePath,
        content: response.content,
        modified: false,
        originalContent: response.content
      };
      
      setOpenFiles([...openFiles, newFile]);
      setActiveFileIndex(openFiles.length);
    } catch (error: any) {
      console.error('Failed to load file:', error);
      addNotification('error', error.response?.data?.message || 'Failed to load file content');
    }
  };

  const handleContentChange = (content: string) => {
    if (openFiles.length === 0) return;
    
    const updatedFiles = [...openFiles];
    updatedFiles[activeFileIndex] = {
      ...updatedFiles[activeFileIndex],
      content,
      modified: content !== updatedFiles[activeFileIndex].originalContent
    };
    setOpenFiles(updatedFiles);
  };

  const handleCloseTab = (index: number) => {
    const file = openFiles[index];
    if (file.modified) {
      if (!confirm(`"${file.path}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    
    const updatedFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(updatedFiles);
    
    if (activeFileIndex >= updatedFiles.length) {
      setActiveFileIndex(Math.max(0, updatedFiles.length - 1));
    }
  };

  const handleSaveAll = async () => {
    const modifiedFiles = openFiles.filter(f => f.modified);
    
    if (modifiedFiles.length === 0) {
      addNotification('info', 'No changes to save');
      return;
    }
    
    setSaving(true);
    try {
      // Save all modified files
      await Promise.all(
        modifiedFiles.map(file =>
          playbooksApi.updateFolderFileContent(playbook.id, file.path, file.content)
        )
      );
      
      // Mark all files as unmodified
      const updatedFiles = openFiles.map(file => ({
        ...file,
        modified: false,
        originalContent: file.content
      }));
      setOpenFiles(updatedFiles);
      
      addNotification('success', `Successfully saved ${modifiedFiles.length} file(s)`);
      onSave();
    } catch (error: any) {
      console.error('Failed to save files:', error);
      addNotification('error', error.response?.data?.message || 'Failed to save files');
    } finally {
      setSaving(false);
    }
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTreeNode = (node: FileNode, level: number = 0): React.ReactNode => {
    if (node.type === 'file') {
      return (
        <div
          key={node.path}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 rounded ${
            selectedFilePath === node.path ? 'bg-blue-50 text-blue-600' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => handleFileSelect(node.path)}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate">{node.name}</span>
        </div>
      );
    }
    
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.path || 'root'}>
        {node.name !== 'root' && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 rounded"
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {hasChildren && (
              isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
            {isExpanded ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-yellow-500" /> : <Folder className="w-4 h-4 flex-shrink-0 text-yellow-500" />}
            <span className="text-sm font-medium truncate">{node.name}</span>
          </div>
        )}
        {(isExpanded || node.name === 'root') && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, node.name === 'root' ? level : level + 1))}
          </div>
        )}
      </div>
    );
  };

  const hasUnsavedChanges = openFiles.some(f => f.modified);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Folder: {playbook.name}
            </h2>
            {hasUnsavedChanges && (
              <p className="text-sm text-orange-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-4 h-4" />
                You have unsaved changes
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading folder structure...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Side: Folder Structure */}
            <div className="w-1/3 border-r overflow-y-auto bg-gray-50">
              <div className="p-3 border-b bg-white sticky top-0 z-10">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  Folder Structure
                </h3>
              </div>
              <div className="p-2">
                {folderStructure && renderTreeNode(folderStructure)}
              </div>
            </div>

            {/* Right Side: File Selector + Tabs + Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File Selector Dropdown */}
              <div className="p-4 border-b bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File to Edit:
                </label>
                <select
                  value={selectedFilePath}
                  onChange={(e) => handleFileSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Choose a file --</option>
                  {fileList.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>

              {/* Tabs */}
              {openFiles.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-2 border-b bg-gray-50 overflow-x-auto">
                  {openFiles.map((file, index) => (
                    <div
                      key={file.path}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-t cursor-pointer min-w-0 ${
                        activeFileIndex === index
                          ? 'bg-white border border-b-0 border-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setActiveFileIndex(index)}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate max-w-[150px]">
                        {file.path.split('/').pop()}
                      </span>
                      {file.modified && <span className="text-orange-500 text-xs">●</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(index);
                        }}
                        className="ml-1 p-0.5 hover:bg-gray-300 rounded flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {openFiles.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Select a file from the dropdown or tree to start editing</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 bg-gray-50 border-b">
                      <p className="text-xs text-gray-600">
                        Editing: <span className="font-mono">{openFiles[activeFileIndex]?.path}</span>
                      </p>
                    </div>
                    <textarea
                      value={openFiles[activeFileIndex]?.content || ''}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="flex-1 p-4 font-mono text-sm border-0 focus:ring-0 resize-none"
                      placeholder="File content will appear here..."
                      spellCheck={false}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {openFiles.length > 0 && (
              <span>
                {openFiles.filter(f => f.modified).length} of {openFiles.length} file(s) modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || !hasUnsavedChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
