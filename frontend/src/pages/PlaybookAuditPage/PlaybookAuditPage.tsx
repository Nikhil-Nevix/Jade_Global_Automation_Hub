/**
 * PlaybookAuditPage Component
 * View detailed audit history for a specific playbook
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Activity, Code2, Eye, EyeOff } from 'lucide-react';
import type { PlaybookAuditLog } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { playbooksApi } from '../../api/api';

export const PlaybookAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useUIStore();

  const [auditLogs, setAuditLogs] = useState<PlaybookAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [playbook_id] = useState<number>(parseInt(id || '0'));

  useEffect(() => {
    loadAuditLogs();
  }, [id]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await playbooksApi.getAuditLogs(parseInt(id || '0'));
      setAuditLogs(data.audit_logs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      addNotification('error', 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const badges = {
      created: 'bg-green-100 text-green-700 border-green-300',
      updated: 'bg-blue-100 text-blue-700 border-blue-300',
      deleted: 'bg-red-100 text-red-700 border-red-300',
      uploaded: 'bg-purple-100 text-purple-700 border-purple-300',
      replaced: 'bg-orange-100 text-orange-700 border-orange-300',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badges[action as keyof typeof badges] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </span>
    );
  };

  const renderDiffViewer = (log: PlaybookAuditLog) => {
    if (!log.old_content && !log.new_content) {
      return (
        <div className="text-center py-8 text-gray-500">
          No content changes available
        </div>
      );
    }

    const oldLines = (log.old_content || '').split('\n');
    const newLines = (log.new_content || '').split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="grid grid-cols-2 gap-4 font-mono text-sm">
        {/* Old Content */}
        <div>
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 font-semibold text-red-900">
            Previous Version
          </div>
          <div className="bg-red-50 dark:bg-gray-800 p-4 max-h-[600px] overflow-auto">
            {oldLines.length > 0 ? (
              oldLines.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-500 select-none w-10 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-gray-900 dark:text-gray-200 flex-1 whitespace-pre">
                    {line || '\n'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic">No previous content</div>
            )}
          </div>
        </div>

        {/* New Content */}
        <div>
          <div className="bg-green-50 border-b border-green-200 px-4 py-2 font-semibold text-green-900">
            Current Version
          </div>
          <div className="bg-green-50 dark:bg-gray-800 p-4 max-h-[600px] overflow-auto">
            {newLines.length > 0 ? (
              newLines.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-500 select-none w-10 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-gray-900 dark:text-gray-200 flex-1 whitespace-pre">
                    {line || '\n'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic">Content deleted</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/playbooks')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Back to Playbooks"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Playbook Audit History</h2>
            <p className="text-gray-600 mt-1">
              {auditLogs.length > 0 ? auditLogs[0].playbook_name : `Playbook #${playbook_id}`}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      {auditLogs.length === 0 ? (
        <div className="bg-white border border-primary-200 shadow-glow rounded-lg p-12 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Audit Logs Found</h3>
          <p className="text-gray-600">This playbook has no recorded changes yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-white border border-primary-200 shadow-glow rounded-lg overflow-hidden">
              {/* Log Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {getActionBadge(log.action)}
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{log.user.username}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{log.user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>
                          {new Date(log.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {(log.old_content || log.new_content) && (
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                      >
                        {expandedLog === log.id ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            Hide Changes
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            View Changes
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {log.changes_description && (
                  <div className="flex items-start gap-2 text-sm bg-gray-50 p-3 rounded-lg">
                    <Code2 className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{log.changes_description}</span>
                  </div>
                )}

                {log.ip_address && (
                  <div className="mt-2 text-xs text-gray-500">
                    IP Address: {log.ip_address}
                  </div>
                )}
              </div>

              {/* Diff Viewer */}
              {expandedLog === log.id && (
                <div className="border-t border-gray-200">
                  {renderDiffViewer(log)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
