import React, { useState, useEffect } from 'react';
import { Globe, Shield, Bell, Save, Clock } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { usersApi } from '../../api/api';
import { COMMON_TIMEZONES, getUserTimezone, setUserTimezone } from '../../utils/timezone';

type SettingsTab = 'general' | 'security' | 'notifications';

interface NotificationPreferences {
  jobFailures: boolean;
  serverOfflineAlerts: boolean;
  maintenanceUpdates: boolean;
  successfulDeployments: boolean;
}

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { autoRefresh, setAutoRefresh, theme, setTheme } = useThemeStore();
  const { user, setUser } = useAuthStore();
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getUserTimezone());
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    jobFailures: true,
    serverOfflineAlerts: true,
    maintenanceUpdates: true,
    successfulDeployments: true,
  });

  // Initialize timezone from user profile
  useEffect(() => {
    if (user?.timezone) {
      setSelectedTimezone(user.timezone);
      setUserTimezone(user.timezone);
    }
  }, [user]);

  const handleSaveGeneral = async () => {
    // Save timezone if changed
    if (selectedTimezone !== user?.timezone) {
      setIsSavingTimezone(true);
      try {
        const updatedUser = await usersApi.updateTimezone(selectedTimezone);
        setUser(updatedUser);
        setUserTimezone(selectedTimezone);
        alert('Timezone preference saved successfully!');
      } catch (error) {
        console.error('Error saving timezone:', error);
        alert('Failed to save timezone preference. Please try again.');
      } finally {
        setIsSavingTimezone(false);
      }
    } else {
      // Preferences are saved automatically via store
      alert('General preferences saved!');
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    // TODO: Implement password change API call
    alert('Password changed successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveNotifications = () => {
    // TODO: Implement save notification preferences
    alert('Notification preferences saved!');
  };

  const tabs = [
    { id: 'general' as SettingsTab, name: 'General', icon: Globe },
    { id: 'security' as SettingsTab, name: 'Security & SSH', icon: Shield },
    { id: 'notifications' as SettingsTab, name: 'Notifications', icon: Bell },
  ];

  return (
    <div className="flex h-full">
      {/* Secondary Sidebar for Settings Tabs */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-glow">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Settings</h2>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">General Settings</h2>
            
            <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-gray-700 shadow-glow rounded-lg shadow-lg p-6 space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Theme Mode
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Switch between light and dark theme.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 dark:peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Auto Refresh */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Auto-refresh Dashboard
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Automatically refresh job status and metrics every 30 seconds.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 dark:peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Timezone Preference */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Clock className="w-4 h-4" />
                  Timezone
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Choose your preferred timezone for displaying dates and times.
                </p>
                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full max-w-md px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 focus:border-primary-500 focus:shadow-glow transition-all"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  onClick={handleSaveGeneral}
                  disabled={isSavingTimezone}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingTimezone ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Security & SSH</h2>
            
            <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-gray-700 shadow-glow rounded-lg shadow-lg p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 focus:border-primary-500 focus:shadow-glow transition-all"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 focus:border-primary-500 focus:shadow-glow transition-all"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 focus:border-primary-500 focus:shadow-glow transition-all"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Notification Preferences</h2>
            
            <div className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-gray-700 shadow-glow rounded-lg shadow-lg p-6 space-y-6">
              <div className="space-y-4">
                {/* Job Failures */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="jobFailures"
                    checked={notifications.jobFailures}
                    onChange={(e) =>
                      setNotifications({ ...notifications, jobFailures: e.target.checked })
                    }
                    className="w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div>
                    <label htmlFor="jobFailures" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Job failures
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive email and in-app notifications.
                    </p>
                  </div>
                </div>

                {/* Server Offline Alerts */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="serverOfflineAlerts"
                    checked={notifications.serverOfflineAlerts}
                    onChange={(e) =>
                      setNotifications({ ...notifications, serverOfflineAlerts: e.target.checked })
                    }
                    className="w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div>
                    <label htmlFor="serverOfflineAlerts" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Server offline alerts
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive email and in-app notifications.
                    </p>
                  </div>
                </div>

                {/* Maintenance Updates */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="maintenanceUpdates"
                    checked={notifications.maintenanceUpdates}
                    onChange={(e) =>
                      setNotifications({ ...notifications, maintenanceUpdates: e.target.checked })
                    }
                    className="w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div>
                    <label htmlFor="maintenanceUpdates" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Maintenance updates
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive email and in-app notifications.
                    </p>
                  </div>
                </div>

                {/* Successful Deployments */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="successfulDeployments"
                    checked={notifications.successfulDeployments}
                    onChange={(e) =>
                      setNotifications({ ...notifications, successfulDeployments: e.target.checked })
                    }
                    className="w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div>
                    <label htmlFor="successfulDeployments" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Successful deployments
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive email and in-app notifications.
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  onClick={handleSaveNotifications}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
