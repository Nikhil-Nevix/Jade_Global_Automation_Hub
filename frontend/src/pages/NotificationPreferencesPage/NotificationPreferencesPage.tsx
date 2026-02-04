/**
 * NotificationPreferencesPage Component
 * Manage notification preferences per event type and channel
 */

import React, { useEffect, useState } from 'react';
import { Save, Bell, Mail, Monitor, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/api';
import type { NotificationPreference } from '../../types';

export const NotificationPreferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.getPreferences();
      setPreferences(response.preferences);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load preferences' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    eventType: string,
    channel: 'in_app_enabled' | 'email_enabled' | 'browser_push_enabled'
  ) => {
    const preference = preferences.find((p) => p.event_type === eventType);
    if (!preference) return;

    const newValue = !preference[channel];

    // Update local state immediately
    setPreferences((prev) =>
      prev.map((p) =>
        p.event_type === eventType ? { ...p, [channel]: newValue } : p
      )
    );

    // Save to backend
    try {
      await notificationsApi.updatePreference(eventType, {
        [channel]: newValue,
      });
    } catch (error) {
      console.error('Failed to update preference:', error);
      // Revert on error
      setPreferences((prev) =>
        prev.map((p) =>
          p.event_type === eventType ? { ...p, [channel]: !newValue } : p
        )
      );
      setMessage({ type: 'error', text: 'Failed to save preference' });
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      // Save all preferences
      await Promise.all(
        preferences.map((pref) =>
          notificationsApi.updatePreference(pref.event_type, {
            in_app_enabled: pref.in_app_enabled,
            email_enabled: pref.email_enabled,
            browser_push_enabled: pref.browser_push_enabled,
          })
        )
      );
      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    return eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getEventTypeDescription = (eventType: string) => {
    const descriptions: Record<string, string> = {
      job_success: 'Notified when a job completes successfully',
      job_failure: 'Notified when a job fails or encounters an error',
      batch_complete: 'Notified when a batch job (multi-server) completes',
      server_failure: 'Notified when a server connection fails',
      high_cpu: 'Notified when a server experiences high CPU usage',
      user_change: 'Notified about user account changes (role, status, etc.)',
      playbook_update: 'Notified when playbooks are uploaded or modified',
      system_alert: 'Notified about critical system alerts (Redis, Celery, etc.)',
    };
    return descriptions[eventType] || 'Notification event';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-800 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Notifications
          </button>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Choose how you want to be notified for different events
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors shadow-glow-sm hover:shadow-glow disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Channel Legend */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <Bell className="h-6 w-6 text-primary-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">In-App</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Notifications appear in the bell icon dropdown and notifications page
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Email</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Notifications sent to your email address
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Monitor className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Browser Push</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Desktop notifications even when tab is not active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-glow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Event Type
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                <div className="flex items-center justify-center gap-2">
                  <Bell className="h-4 w-4" />
                  In-App
                </div>
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                <div className="flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                <div className="flex items-center justify-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Browser Push
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {preferences.map((pref) => (
              <tr key={pref.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {getEventTypeLabel(pref.event_type)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {getEventTypeDescription(pref.event_type)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pref.in_app_enabled}
                      onChange={() => handleToggle(pref.event_type, 'in_app_enabled')}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pref.email_enabled}
                      onChange={() => handleToggle(pref.event_type, 'email_enabled')}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pref.browser_push_enabled}
                      onChange={() => handleToggle(pref.event_type, 'browser_push_enabled')}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Note</h4>
            <p className="text-sm text-blue-800 dark:text-blue-400">
              Changes are saved automatically when you toggle each option. Use "Save All" to ensure all preferences are persisted.
              Email notifications require SMTP configuration on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
