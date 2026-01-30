import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, User as UserIcon, X, ArrowUp, ArrowDown } from 'lucide-react';
import { usersApi } from '../../api/api';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.list({ page: 1, per_page: 100 });
      setUsers(response.items);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
  };

  const handlePromoteToAdmin = async () => {
    if (!editingUser) return;

    try {
      setUpdatingRole(true);
      const updatedUser = await usersApi.update(editingUser.id, { role: 'admin' });
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      alert(`${editingUser.username} has been promoted to Admin`);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to promote user:', error);
      alert('Failed to promote user. Please try again.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDemoteToUser = async () => {
    if (!editingUser) return;

    try {
      setUpdatingRole(true);
      const updatedUser = await usersApi.update(editingUser.id, { role: 'user' });
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      alert(`${editingUser.username} has been demoted to User`);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to demote user:', error);
      alert('Failed to demote user. Please try again.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This will also delete all jobs created by this user.`)) {
      return;
    }

    try {
      await usersApi.delete(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'super_admin':
        return 'bg-red-100 text-red-700';
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'user':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canPromoteUser = (targetUser: User) => {
    // Only admins and super_admins can promote
    if (!isAdmin) return false;
    
    // Can only promote regular users to admin
    if (targetUser.role !== 'user') return false;
    
    return true;
  };

  const canDemoteUser = (targetUser: User) => {
    // Only super_admin can demote
    if (!isSuperAdmin) return false;
    
    // Can only demote admins to user
    if (targetUser.role !== 'admin') return false;
    
    // Cannot demote yourself
    if (targetUser.id === currentUser?.id) return false;
    
    return true;
  };

  const canDeleteUser = (targetUser: User) => {
    // Only super_admin can delete users
    if (!isSuperAdmin) return false;
    
    // Cannot delete yourself
    if (targetUser.id === currentUser?.id) return false;
    
    return true;
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'super_admin':
        return <Shield className="h-4 w-4" />;
      case 'admin':
        return <Shield className="w-3 h-3 inline mr-1" />;
      case 'user':
        return <UserIcon className="w-3 h-3 inline mr-1" />;
      default:
        return <UserIcon className="w-3 h-3 inline mr-1" />;
    }
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    return date.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getInitials = (username: string) => {
    return username.substring(0, 1).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">User Management</h1>
        </div>
        <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 shadow-glow-sm hover:shadow-glow">
          <Plus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-primary-200 shadow-glow rounded-lg shadow-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
                User
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
                Role
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
                Last Login
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                {/* User Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {getInitials(user.username)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.username}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                  </div>
                </td>

                {/* Role Badge */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                    {getRoleIcon(user.role)}
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>

                {/* Last Login */}
                <td className="px-6 py-4 text-sm text-gray-700">
                  {formatLastLogin(user.last_login)}
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-gray-600 hover:text-primary-600 transition-colors"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteUser(user) && (
                      <button
                        onClick={() => handleDelete(user.id, user.username)}
                        className="text-gray-600 hover:text-error-600 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            No users found
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit User Role</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-300 font-semibold text-lg">
                    {getInitials(editingUser.username)}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{editingUser.username}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{editingUser.email}</div>
                </div>
              </div>

              {/* Current Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Role
                </label>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${getRoleBadgeColor(editingUser.role)}`}>
                    {getRoleIcon(editingUser.role)}
                    {editingUser.role.charAt(0).toUpperCase() + editingUser.role.slice(1)}
                  </span>
                </div>
              </div>

              {/* Role Actions */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role Actions
                </label>

                {/* Promote to Admin */}
                {canPromoteUser(editingUser) && (
                  <button
                    onClick={handlePromoteToAdmin}
                    disabled={updatingRole}
                    className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <div className="text-left">
                        <div className="font-medium text-purple-900 dark:text-purple-300">Promote to Admin</div>
                        <div className="text-xs text-purple-700 dark:text-purple-400">Grant administrative privileges</div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Demote to User */}
                {canDemoteUser(editingUser) && (
                  <button
                    onClick={handleDemoteToUser}
                    disabled={updatingRole}
                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="text-left">
                        <div className="font-medium text-blue-900 dark:text-blue-300">Demote to User</div>
                        <div className="text-xs text-blue-700 dark:text-blue-400">Remove administrative privileges</div>
                      </div>
                    </div>
                  </button>
                )}

                {/* No actions available */}
                {!canPromoteUser(editingUser) && !canDemoteUser(editingUser) && (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">
                    {editingUser.id === currentUser?.id
                      ? "You cannot modify your own role"
                      : editingUser.role === 'super_admin'
                      ? "Super Admin role cannot be modified"
                      : "No role actions available"}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
