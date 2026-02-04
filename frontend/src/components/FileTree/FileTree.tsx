import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import type { FileTreeNode } from '../../types';

interface FileTreeProps {
  tree: FileTreeNode;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, onFileSelect, selectedFilePath }) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const isFolder = node.type === 'folder';
  const isSelected = node.path === selectedFilePath;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else if (onFileSelect) {
      onFileSelect(node.path);
    }
  };

  const getFileIcon = () => {
    if (isFolder) {
      return isExpanded ? <FolderOpen className="w-4 h-4 text-yellow-500" /> : <Folder className="w-4 h-4 text-yellow-600" />;
    }
    
    // Different icons based on extension
    const ext = node.extension?.toLowerCase();
    if (ext === '.yml' || ext === '.yaml') {
      return <File className="w-4 h-4 text-blue-500" />;
    } else if (ext === '.j2') {
      return <File className="w-4 h-4 text-green-500" />;
    } else if (ext === '.py') {
      return <File className="w-4 h-4 text-indigo-500" />;
    } else if (ext === '.sh') {
      return <File className="w-4 h-4 text-purple-500" />;
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors ${
          isSelected
            ? 'bg-purple-100 text-purple-900'
            : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder && hasChildren && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </span>
        )}
        {isFolder && !hasChildren && <span className="w-4" />}
        {!isFolder && <span className="w-4" />}
        
        {getFileIcon()}
        
        <span className="flex-1 text-sm truncate">{node.name}</span>
        
        {!isFolder && node.size && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {isFolder && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFilePath={selectedFilePath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ tree, onFileSelect, selectedFilePath }) => {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-auto max-h-[600px]">
      <div className="p-2">
        <TreeNode
          node={tree}
          level={0}
          onFileSelect={onFileSelect}
          selectedFilePath={selectedFilePath}
        />
      </div>
    </div>
  );
};

export default FileTree;
