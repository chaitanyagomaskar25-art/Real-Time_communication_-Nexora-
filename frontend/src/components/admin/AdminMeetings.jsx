import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Radio,
  StopCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import Button from '../common/Button';
import Badge from '../common/Badge';

const AdminMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportedOnly, setReportedOnly] = useState(false);

  // Modals state
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [terminationReason, setTerminationReason] = useState('Violation of NEXORA terms of service');
  const [isTerminating, setIsTerminating] = useState(false);

  // Investigation & Report Resolution state
  const [activeReport, setActiveReport] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const fetchMeetings = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminService.getMeetings({
        page,
        limit: 10,
        search,
        status: statusFilter,
        reportedOnly
      });
      setMeetings(res.meetings || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.warn('Failed to fetch admin meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, reportedOnly]);

  useEffect(() => {
    fetchMeetings(1);
  }, [fetchMeetings]);

  const handleOpenDetails = async (meeting) => {
    try {
      const full = await adminService.getMeetingDetails(meeting.meetingId);
      setSelectedMeeting(full);
    } catch {
      setSelectedMeeting(meeting);
    }
  };

  const handleExecuteTerminate = async (e) => {
    e.preventDefault();
    if (!terminateTarget) return;

    try {
      setIsTerminating(true);
      await adminService.terminateMeeting(terminateTarget.meetingId, {
        reason: terminationReason
      });

      // Update in local state
      setMeetings((prev) =>
        prev.map((m) =>
          m.meetingId === terminateTarget.meetingId
            ? { ...m, status: 'ended', isTerminatedByAdmin: true }
            : m
        )
      );

      if (selectedMeeting && selectedMeeting.meetingId === terminateTarget.meetingId) {
        setSelectedMeeting((prev) => ({ ...prev, status: 'ended', isTerminatedByAdmin: true }));
      }

      setTerminateTarget(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Termination failed');
    } finally {
      setIsTerminating(false);
    }
  };

  const handleResolveReport = async (e) => {
    e.preventDefault();
    if (!selectedMeeting || !activeReport) return;

    try {
      setIsResolving(true);
      await adminService.resolveReport(selectedMeeting.meetingId, activeReport.reportId || activeReport._id, {
        status: resolutionStatus,
        resolutionNotes
      });

      // Update local report
      const updatedReports = (selectedMeeting.reports || []).map((r) =>
        (r.reportId || r._id) === (activeReport.reportId || activeReport._id)
          ? { ...r, status: resolutionStatus, resolutionNotes }
          : r
      );

      const hasPending = updatedReports.some((r) => r.status === 'pending' || r.status === 'investigating');
      setSelectedMeeting((prev) => ({ ...prev, reports: updatedReports, isReported: hasPending }));
      setMeetings((prev) =>
        prev.map((m) => (m.meetingId === selectedMeeting.meetingId ? { ...m, isReported: hasPending } : m))
      );

      setActiveReport(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Report update failed');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Search & Filter Bar */}
      <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search meetings by ID, title, or host..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden lg:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Ongoing)</option>
              <option value="scheduled">Scheduled</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reported Only Toggle */}
          <button
            onClick={() => setReportedOnly((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              reportedOnly
                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Reported Only</span>
          </button>
        </div>
      </div>

      {/* Meetings Data Table */}
      <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading meeting history...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No meetings found matching current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Meeting</th>
                  <th className="py-3.5 px-4 font-semibold">Host</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Participants</th>
                  <th className="py-3.5 px-4 font-semibold">Scheduled / Date</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {meetings.map((m) => {
                  const isOngoing = m.status === 'active';
                  const isReported = m.isReported || (m.reports && m.reports.length > 0);

                  return (
                    <tr key={m.meetingId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {m.title}
                              </p>
                              {isReported && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  REPORTED
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {m.meetingId}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {m.hostName || 'Host'}
                        </span>
                        {m.hostEmail && (
                          <span className="block text-[10px] text-slate-400">{m.hostEmail}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            m.status === 'active'
                              ? 'success'
                              : m.status === 'scheduled'
                              ? 'primary'
                              : m.isTerminatedByAdmin
                              ? 'danger'
                              : 'default'
                          }
                          size="sm"
                          dot={isOngoing}
                        >
                          {m.isTerminatedByAdmin ? 'TERMINATED' : m.status.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {m.participantCount ?? (m.participants?.length || 0)} participants
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(m)}
                            title="Inspect Meeting Metadata & Reports"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isOngoing && (
                            <button
                              onClick={() => setTerminateTarget(m)}
                              title="Force Terminate Abusive Meeting"
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            >
                              <StopCircle className="w-4 h-4" />
                            </button>
                          )}
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
                onClick={() => fetchMeetings(pagination.page - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchMeetings(pagination.page + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Force Terminate Meeting Modal */}
      {terminateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleExecuteTerminate}
            className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <StopCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Force Terminate Meeting</h3>
                <p className="text-xs text-slate-400">Meeting: {terminateTarget.title} ({terminateTarget.meetingId})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              This will immediately disconnect all connected peers via Socket.IO signaling and mark the meeting ended.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason for Termination (Broadcast to participants)
              </label>
              <textarea
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="Reason for administrative intervention..."
                rows={3}
                required
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setTerminateTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="submit"
                isLoading={isTerminating}
              >
                Terminate Immediately
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Meeting Metadata & Abuse Investigation Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Meeting Metadata & Investigation
                </h3>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Basic Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl">
                <span className="text-slate-400">Meeting ID</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedMeeting.meetingId}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl">
                <span className="text-slate-400">Host</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedMeeting.hostName}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl">
                <span className="text-slate-400">Status</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 uppercase">{selectedMeeting.status}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl">
                <span className="text-slate-400">Duration</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedMeeting.duration || 30} mins</p>
              </div>
            </div>

            {/* Reported Abuse Queue */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Reported Abusive Activity ({selectedMeeting.reports?.length || 0})</span>
              </div>

              {(!selectedMeeting.reports || selectedMeeting.reports.length === 0) ? (
                <p className="text-xs text-slate-400 p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl text-center">
                  No user abuse reports logged for this meeting.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedMeeting.reports.map((report, idx) => {
                    const rid = report.reportId || report._id || idx;
                    return (
                      <div
                        key={rid}
                        className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-rose-500 capitalize">
                            Reason: {report.reason?.replace('_', ' ')}
                          </span>
                          <Badge
                            variant={
                              report.status === 'resolved'
                                ? 'success'
                                : report.status === 'dismissed'
                                ? 'default'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {report.status?.toUpperCase()}
                          </Badge>
                        </div>
                        {report.description && (
                          <p className="text-slate-600 dark:text-slate-300 italic">
                            "{report.description}"
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          <span>By: {report.reporterName || 'Anonymous'}</span>
                          <button
                            onClick={() => {
                              setActiveReport(report);
                              setResolutionStatus(report.status || 'resolved');
                              setResolutionNotes(report.resolutionNotes || '');
                            }}
                            className="font-semibold text-brand-500 hover:text-brand-600"
                          >
                            Investigate & Resolve →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Associated Shared Files Metadata */}
            {selectedMeeting.files && selectedMeeting.files.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  Shared Files Metadata ({selectedMeeting.files.length})
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                  {selectedMeeting.files.map((file) => (
                    <div
                      key={file.fileId}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300"
                    >
                      <span className="truncate max-w-[200px] font-medium">{file.originalName}</span>
                      <span className="text-[10px] text-slate-400">
                        {Math.round(file.size / 1024)} KB • By {file.uploaderName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setSelectedMeeting(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Investigate & Resolve Abuse Report Sub-Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleResolveReport}
            className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-brand-500">
              <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Investigate Meeting Report</h3>
                <p className="text-xs text-slate-400">Report ID: {activeReport.reportId}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Resolution Action
              </label>
              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
              >
                <option value="investigating">Mark as Investigating</option>
                <option value="resolved">Mark as Resolved (Abuse Addressed)</option>
                <option value="dismissed">Dismiss (False Alarm / No Violation)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Resolution Notes / Audit Summary
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Findings and action taken..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setActiveReport(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isResolving}
              >
                Save Resolution
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminMeetings;
