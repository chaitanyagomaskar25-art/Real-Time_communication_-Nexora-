import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  Shield,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Video,
  FileText
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import Button from '../common/Button';
import Badge from '../common/Badge';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const [actionType, setActionType] = useState(null); // 'suspend' | 'role'
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminService.getUsers({
        page,
        limit: 10,
        search,
        role: roleFilter,
        status: statusFilter
      });
      setUsers(res.users || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.warn('Failed to fetch admin users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleOpenSuspendModal = (user) => {
    setActionUser(user);
    setActionType('suspend');
    setSuspendReason(user.status === 'suspended' ? '' : 'Violation of platform community standards');
  };

  const handleOpenRoleModal = (user) => {
    setActionUser(user);
    setActionType('role');
    setSelectedRole(user.role || 'user');
  };

  const handleOpenDetails = async (user) => {
    try {
      const detailed = await adminService.getUserDetails(user.id || user._id);
      setSelectedUser(detailed);
    } catch {
      setSelectedUser(user);
    }
  };

  const handleExecuteSuspend = async (e) => {
    e.preventDefault();
    if (!actionUser) return;

    try {
      setSubmittingAction(true);
      const newStatus = actionUser.status === 'suspended' ? 'active' : 'suspended';
      await adminService.updateUserStatus(actionUser.id || actionUser._id, {
        status: newStatus,
        reason: suspendReason
      });

      // Update in local state
      setUsers((prev) =>
        prev.map((u) => ((u.id || u._id) === (actionUser.id || actionUser._id) ? { ...u, status: newStatus } : u))
      );
      setActionUser(null);
      setActionType(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExecuteRoleChange = async (e) => {
    e.preventDefault();
    if (!actionUser) return;

    try {
      setSubmittingAction(true);
      await adminService.updateUserRole(actionUser.id || actionUser._id, {
        role: selectedRole
      });

      setUsers((prev) =>
        prev.map((u) => ((u.id || u._id) === (actionUser.id || actionUser._id) ? { ...u, role: selectedRole } : u))
      );
      setActionUser(null);
      setActionType(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Role update failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search & Filter Header Bar */}
      <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden lg:inline">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden lg:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No users found matching current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User</th>
                  <th className="py-3.5 px-4 font-semibold">Username</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Joined Date</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {users.map((u) => {
                  const uid = u.id || u._id;
                  const isSuspended = u.status === 'suspended';

                  return (
                    <tr key={uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName || 'User')}`}
                            alt=""
                            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {u.fullName || u.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        @{u.username || 'user'}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={u.role === 'admin' ? 'danger' : u.role === 'moderator' ? 'warning' : 'default'}
                          size="sm"
                        >
                          {u.role || 'user'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={isSuspended ? 'danger' : 'success'}
                          size="sm"
                          dot
                        >
                          {isSuspended ? 'Suspended' : 'Active'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(u)}
                            title="View Account Details"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            title="Change Role"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Shield className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenSuspendModal(u)}
                            title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isSuspended
                                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                            }`}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">User Account Inspection</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={selectedUser.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedUser.fullName || 'User')}`}
                alt=""
                className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800"
              />
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedUser.fullName || selectedUser.name}
                </h4>
                <p className="text-xs text-slate-400">@{selectedUser.username} • {selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={selectedUser.role === 'admin' ? 'danger' : 'default'} size="sm">
                    {selectedUser.role || 'user'}
                  </Badge>
                  <Badge variant={selectedUser.status === 'suspended' ? 'danger' : 'success'} size="sm">
                    {selectedUser.status || 'active'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Platform usage metrics */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-brand-500" />
                  Meetings Hosted
                </span>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {selectedUser.stats?.createdMeetingsCount ?? 0}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  Files Uploaded
                </span>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {selectedUser.stats?.filesUploadedCount ?? 0}
                </p>
              </div>
            </div>

            {selectedUser.status === 'suspended' && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-300">
                <strong>Suspension Note:</strong> {selectedUser.suspendedReason || 'Administrative suspension.'}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / Reactivate Confirmation Modal */}
      {actionUser && actionType === 'suspend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleExecuteSuspend}
            className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {actionUser.status === 'suspended' ? 'Reactivate Account' : 'Suspend User Account'}
                </h3>
                <p className="text-xs text-slate-400">Target: {actionUser.fullName} (@{actionUser.username})</p>
              </div>
            </div>

            {actionUser.status !== 'suspended' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Suspension
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Enter reason for audit record..."
                  rows={3}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setActionUser(null);
                  setActionType(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={actionUser.status === 'suspended' ? 'primary' : 'danger'}
                size="sm"
                type="submit"
                isLoading={submittingAction}
              >
                {actionUser.status === 'suspended' ? 'Confirm Reactivate' : 'Confirm Suspension'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Role Management Modal */}
      {actionUser && actionType === 'role' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleExecuteRoleChange}
            className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Manage Account Role</h3>
                <p className="text-xs text-slate-400">Target: {actionUser.fullName} (@{actionUser.username})</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Platform Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
              >
                <option value="user">User (Standard Access)</option>
                <option value="moderator">Moderator (Meeting Oversight)</option>
                <option value="admin">Administrator (Full Dashboard & Security Access)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setActionUser(null);
                  setActionType(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={submittingAction}
              >
                Update Role
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
