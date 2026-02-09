/**
 * Interactive Patches Dialog
 * Displays available patches for user selection with countdown timer
 */
import React, { useState, useEffect } from 'react';
import { X, Clock, Package, AlertTriangle } from 'lucide-react';
import api from '../../api/api';

interface InteractivePatchesDialogProps {
  jobId: string;
  filePath: string;
  onClose: () => void;
  timeoutSeconds?: number;
}

interface Patch {
  name: string;
  selected: boolean;
}

export const InteractivePatchesDialog: React.FC<InteractivePatchesDialogProps> = ({
  jobId,
  filePath,
  onClose,
  timeoutSeconds = 3600, // Default 1 hour
}) => {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timeoutSeconds);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch available patches
  useEffect(() => {
    const fetchPatches = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/jobs/${jobId}/available-patches`, {
          params: { file_path: filePath },
        });

        const patchList = response.data.patches.map((p: string) => ({
          name: p,
          selected: false,
        }));

        setPatches(patchList);
        setLoading(false);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch patches');
        setLoading(false);
      }
    };

    fetchPatches();
  }, [jobId, filePath]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle timeout - cancel job
  const handleTimeout = async () => {
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      alert('Job cancelled due to timeout - no response received');
      onClose();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  // Toggle individual patch selection
  const togglePatch = (index: number) => {
    setPatches((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  // Toggle select all
  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setPatches((prev) => prev.map((p) => ({ ...p, selected: newSelectAll })));
  };

  // Submit selected patches
  const handleSubmit = async () => {
    const selectedPatches = patches.filter((p) => p.selected).map((p) => p.name);

    if (selectedPatches.length === 0) {
      alert('Please select at least one patch');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/jobs/${jobId}/selected-patches`, {
        selected_patches: selectedPatches,
        file_path: filePath.replace('available_patches', 'selected_patches'),
      });

      alert(`${selectedPatches.length} patch(es) submitted successfully`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit patches');
      setSubmitting(false);
    }
  };

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Patches to Install
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Timer Warning */}
        <div
          className={`px-6 py-3 flex items-center gap-2 ${
            timeRemaining < 60
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : timeRemaining < 300
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="font-medium">Time remaining: {formatTime(timeRemaining)}</span>
          {timeRemaining < 60 && (
            <AlertTriangle className="h-5 w-5 ml-auto animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400 text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3" />
              <p>{error}</p>
            </div>
          ) : patches.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No patches available</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Select All ({patches.length} patches)
                  </span>
                </label>
              </div>

              {/* Patches List */}
              <div className="space-y-2">
                {patches.map((patch, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={patch.selected}
                      onChange={() => togglePatch(index)}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                      {patch.name}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {patches.filter((p) => p.selected).length} of {patches.length} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || loading || patches.filter((p) => p.selected).length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
