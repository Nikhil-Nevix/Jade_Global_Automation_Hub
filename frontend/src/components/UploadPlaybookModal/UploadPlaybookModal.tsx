import React, { useState, useRef } from 'react';
import { X, Upload, FileText, FolderOpen, Package, Loader2, ChevronDown } from 'lucide-react';
import { playbooksApi } from '../../api/api';

type UploadType = 'single' | 'zip' | 'folder';

interface UploadPlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export const UploadPlaybookModal: React.FC<UploadPlaybookModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const [uploadType, setUploadType] = useState<UploadType>('single');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [yamlFiles, setYamlFiles] = useState<string[]>([]);
  const [suggestedMain, setSuggestedMain] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    file: null as File | null,
    name: '',
    description: '',
    mainPlaybookFile: '',
  });

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormData({ ...formData, file });

    // If ZIP file, analyze it to get YAML file list
    if (uploadType === 'zip' && file.name.endsWith('.zip')) {
      setAnalyzing(true);
      setYamlFiles([]);
      setSuggestedMain('');
      setFormData({ ...formData, file, mainPlaybookFile: '' });

      try {
        const preview = await playbooksApi.previewZip(file);
        setYamlFiles(preview.yaml_files);
        setSuggestedMain(preview.suggested_main);
        
        // Auto-select suggested main file
        setFormData(prev => ({ ...prev, mainPlaybookFile: preview.suggested_main }));
        
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to analyze ZIP file';
        onError(errorMsg);
        setFormData({ ...formData, file: null });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.file || !formData.name) {
      onError('Please provide both file and playbook name');
      return;
    }

    setUploading(true);

    try {
      if (uploadType === 'single') {
        // Upload single file
        await playbooksApi.upload(formData.file, formData.name, formData.description);
      } else if (uploadType === 'zip') {
        // Upload ZIP folder
        if (!formData.mainPlaybookFile) {
          onError('Please select the main playbook file');
          setUploading(false);
          return;
        }
        await playbooksApi.uploadFolder(
          formData.file,
          formData.name,
          formData.mainPlaybookFile,
          formData.description
        );
      } else {
        // Folder upload (would need to create ZIP client-side)
        onError('Folder upload coming soon. Please use ZIP upload for now.');
        setUploading(false);
        return;
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      onError(error.response?.data?.message || 'Failed to upload playbook');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFormData({ file: null, name: '', description: '', mainPlaybookFile: '' });
    setYamlFiles([]);
    setSuggestedMain('');
    setUploadType('single');
    setAnalyzing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold text-gray-900">
            Upload Ansible Playbook
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Upload Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Upload Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setUploadType('single')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  uploadType === 'single'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${uploadType === 'single' ? 'text-purple-600' : 'text-gray-400'}`} />
                <div className="text-sm font-medium">Single File</div>
                <div className="text-xs text-gray-500 mt-1">.yml or .yaml</div>
              </button>

              <button
                type="button"
                onClick={() => setUploadType('zip')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  uploadType === 'zip'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Package className={`w-8 h-8 mx-auto mb-2 ${uploadType === 'zip' ? 'text-purple-600' : 'text-gray-400'}`} />
                <div className="text-sm font-medium">ZIP Folder</div>
                <div className="text-xs text-gray-500 mt-1">Max 20 MB</div>
              </button>

              <button
                type="button"
                onClick={() => setUploadType('folder')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  uploadType === 'folder'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled
              >
                <FolderOpen className={`w-8 h-8 mx-auto mb-2 ${uploadType === 'folder' ? 'text-purple-600' : 'text-gray-300'}`} />
                <div className="text-sm font-medium text-gray-400">Upload Folder</div>
                <div className="text-xs text-gray-400 mt-1">Coming Soon</div>
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {uploadType === 'single' ? 'Playbook File' : 'ZIP File'}
            </label>
            <label
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center py-4">
                <Upload className="w-10 h-10 mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {uploadType === 'single' ? 'YAML files (.yml, .yaml) - Max 500 KB' : 'ZIP files - Max 20 MB'}
                </p>
                {formData.file && (
                  <p className="mt-2 text-sm text-purple-600 font-medium">
                    ✓ {formData.file.name}
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={uploadType === 'single' ? '.yml,.yaml' : '.zip'}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Main Playbook Selection (for ZIP only) - Now with Dropdown */}
          {uploadType === 'zip' && formData.file && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Playbook File *
                {analyzing && (
                  <span className="ml-2 text-xs text-purple-600">
                    <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                    Analyzing ZIP...
                  </span>
                )}
              </label>
              
              {yamlFiles.length > 0 ? (
                <>
                  <div className="relative">
                    <select
                      required
                      value={formData.mainPlaybookFile}
                      onChange={(e) => setFormData({ ...formData, mainPlaybookFile: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none pr-10"
                    >
                      {yamlFiles.map((file) => (
                        <option key={file} value={file}>
                          {file} {file === suggestedMain ? '(Recommended)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Found {yamlFiles.length} YAML file{yamlFiles.length !== 1 ? 's' : ''} in ZIP
                  </p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    required
                    placeholder="e.g., site.yml or playbook/main.yml"
                    value={formData.mainPlaybookFile}
                    onChange={(e) => setFormData({ ...formData, mainPlaybookFile: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={analyzing}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {analyzing 
                      ? 'Analyzing ZIP file to detect YAML files...'
                      : 'Enter the relative path to the main playbook file (e.g., playbook/package_installation_upgrade.yml)'
                    }
                  </p>
                </>
              )}
            </div>
          )}

          {/* Playbook Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Playbook Name *
            </label>
            <input
              type="text"
              required
              placeholder="My Ansible Playbook"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Enter playbook description..."
              className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm disabled:opacity-50"
              disabled={uploading || !formData.file || !formData.name}
            >
              {uploading ? 'Uploading...' : 'Upload Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
