/**
 * NotificationsPage Component
 * Full notifications history page with filtering and management
 */

import React, { useEffect, useState } from 'react';
import { Bell, Filter, Trash2, Check, CheckCheck, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/api';
import { getUserTimezone } from '../../utils/timezone';
import type { Notification, NotificationSeverity } from '../../types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | 'all'>('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  const buildDummyNotifications = (): Notification[] => {
    const now = new Date();
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

    return [
      {
        id: 1001,
        user_id: 1,
        title: 'Playbook execution completed',
        message: 'Playbook "deploy-webapp" completed successfully on web-server-01.',
        severity: 'info',
        event_type: 'job_success',
        related_entity_type: 'job',
        related_entity_id: 101,
        is_read: false,
        read_at: null,
        channels_sent: ['in_app'],
        metadata: { playbook: 'deploy-webapp', server: 'web-server-01' },
        created_at: minutesAgo(15),
        expires_at: null,
      },
      {
        id: 1002,
        user_id: 1,
        title: 'Playbook execution failed',
        message: 'Playbook "system-update" failed on db-server-01: SSH connection timeout.',
        severity: 'error',
        event_type: 'job_failure',
        related_entity_type: 'job',
        related_entity_id: 102,
        is_read: false,
        read_at: null,
        channels_sent: ['in_app', 'email'],
        metadata: { playbook: 'system-update', server: 'db-server-01' },
        created_at: hoursAgo(2),
        expires_at: null,
      },
      {
        id: 1003,
        user_id: 1,
        title: 'High CPU usage detected',
        message: 'server-api-02 reported CPU usage above 90% for 10 minutes.',
        severity: 'warning',
        event_type: 'high_cpu',
        related_entity_type: 'server',
        related_entity_id: 7,
        is_read: true,
        read_at: hoursAgo(1),
        channels_sent: ['in_app'],
        metadata: { server: 'server-api-02', metric: 'cpu', value: 92 },
        created_at: hoursAgo(3),
        expires_at: null,
      },
      {
        id: 1004,
        user_id: 1,
        title: 'Batch execution completed',
        message: 'Batch job finished: 12 successful, 2 failed out of 14 servers.',
        severity: 'warning',
        event_type: 'batch_complete',
        related_entity_type: 'job',
        related_entity_id: 103,
        is_read: true,
        read_at: hoursAgo(4),
        channels_sent: ['in_app'],
        metadata: { success: 12, failed: 2, total: 14 },
        created_at: hoursAgo(6),
        expires_at: null,
      },
      {
        id: 1005,
        user_id: 1,
        title: 'System alert',
        message: 'Redis queue latency exceeded threshold. Please check worker health.',
        severity: 'critical',
        event_type: 'system_alert',
        related_entity_type: 'system',
        related_entity_id: 1,
        is_read: false,
        read_at: null,
        channels_sent: ['in_app', 'email'],
        metadata: { component: 'redis', queue: 'celery' },
        created_at: hoursAgo(12),
        expires_at: null,
      },
      {
        id: 1006,
        user_id: 1,
        title: 'Server unreachable',
        message: 'web-server-02 failed health check: host unreachable.',
        severity: 'error',
        event_type: 'server_failure',
        related_entity_type: 'server',
        related_entity_id: 8,
        is_read: false,
        read_at: null,
        channels_sent: ['in_app'],
        metadata: { server: 'web-server-02', reason: 'host unreachable' },
        created_at: hoursAgo(8),
        expires_at: null,
      },
      {
        id: 1007,
        user_id: 1,
        title: 'Playbook updated',
        message: 'Playbook "backup-database" was updated by admin.',
        severity: 'info',
        event_type: 'playbook_update',
        related_entity_type: 'playbook',
        related_entity_id: 12,
        is_read: true,
        read_at: hoursAgo(9),
        channels_sent: ['in_app'],
        metadata: { playbook: 'backup-database', actor: 'admin' },
        created_at: hoursAgo(10),
        expires_at: null,
      },
      {
        id: 1008,
        user_id: 1,
        title: 'User role changed',
        message: 'User "ops-user" role updated to admin.',
        severity: 'warning',
        event_type: 'user_change',
        related_entity_type: 'user',
        related_entity_id: 4,
        is_read: true,
        read_at: hoursAgo(18),
        channels_sent: ['in_app'],
        metadata: { username: 'ops-user', role: 'admin' },
        created_at: hoursAgo(20),
        expires_at: null,
      },
      {
        id: 1009,
        user_id: 1,
        title: 'Job retry succeeded',
        message: 'Retry of "system-update" completed successfully on app-server-03.',
        severity: 'info',
        event_type: 'job_success',
        related_entity_type: 'job',
        related_entity_id: 104,
        is_read: true,
        read_at: hoursAgo(22),
        channels_sent: ['in_app'],
        metadata: { playbook: 'system-update', server: 'app-server-03' },
        created_at: hoursAgo(23),
        expires_at: null,
      },
      {
        id: 1010,
        user_id: 1,
        title: 'Batch job warning',
        message: 'Batch execution completed with warnings on 3 servers.',
        severity: 'warning',
        event_type: 'batch_complete',
        related_entity_type: 'job',
        related_entity_id: 105,
        is_read: false,
        read_at: null,
        channels_sent: ['in_app', 'email'],
        metadata: { warnings: 3, total: 18 },
        created_at: hoursAgo(26),
        expires_at: null,
      },
    ];
  };

  useEffect(() => {
    loadNotifications();
  }, [filter, severityFilter, page]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.list({
        unread_only: filter === 'unread',
        limit,
        offset: page * limit,
      });
      
      const sourceNotifications = response.notifications.length > 0
        ? response.notifications
        : buildDummyNotifications();

      // Apply severity filter client-side
      let filteredNotifications = sourceNotifications;
      if (severityFilter !== 'all') {
        filteredNotifications = filteredNotifications.filter(
          (n) => n.severity === severityFilter
        );
      }
      
      setNotifications(filteredNotifications);
      setTotal(response.total || sourceNotifications.length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      const fallbackNotifications = buildDummyNotifications();
      const filteredFallback = severityFilter === 'all'
        ? fallbackNotifications
        : fallbackNotifications.filter((n) => n.severity === severityFilter);
      setNotifications(filteredFallback);
      setTotal(filteredFallback.length);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleDeleteAllRead = async () => {
    if (!window.confirm('Delete all read notifications? This cannot be undone.')) {
      return;
    }
    
    try {
      await notificationsApi.deleteAllRead();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      loadNotifications();
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    if (notification.related_entity_type === 'job' && notification.related_entity_id) {
      navigate(`/jobs/${notification.related_entity_id}`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'critical':
        return 'bg-red-200 text-red-900 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🔴';
      default:
        return '🔔';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getUserTimezone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteAllRead}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Read
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          )}
          <button
            onClick={() => navigate('/notifications/preferences')}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-colors shadow-glow-sm hover:shadow-glow"
          >
            <Settings className="h-4 w-4" />
            Preferences
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
        </div>
        
        {/* Read/Unread Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'unread'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Unread
          </button>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity:</span>
          {(['all', 'info', 'warning', 'error', 'critical'] as const).map((severity) => (
            <button
              key={severity}
              onClick={() => setSeverityFilter(severity)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                severityFilter === severity
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Bell className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No notifications found</p>
            <p className="text-gray-400 text-sm mt-2">
              {filter === 'unread' ? 'All notifications have been read' : 'You have no notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <span className="text-3xl">{getSeverityIcon(notification.severity)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {formatDateTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-medium rounded-md border ${getSeverityColor(
                            notification.severity
                          )}`}
                        >
                          {notification.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {notification.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {notification.channels_sent.length > 0 && (
                          <span className="text-xs text-gray-400">
                            • Sent via: {notification.channels_sent.join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                          >
                            <Check className="h-4 w-4" />
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > limit && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} notifications
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
