import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  Copy,
  Check,
  Download,
  Video,
  RefreshCw,
  Plus
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { meetingService } from '../services/meetingService';

const MeetingHistory = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, completed, missed, scheduled
  const [copiedId, setCopiedId] = useState(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await meetingService.getMeetingHistory();
      const list = Array.isArray(data) ? data : (data?.data || []);
      const scheduledOnly = list.filter((m) => {
        const mId = (m.meetingId || m.roomId || '').toLowerCase();
        const mTitle = (m.title || '').toLowerCase();
        const isChatCall =
          mId.startsWith('dm-') ||
          mId.startsWith('voice-') ||
          mId.includes('-video-') ||
          mId.includes('-voice-') ||
          mTitle.includes('voice call') ||
          mTitle.includes('video call') ||
          m.meetingType === 'chat_call';
        const isScheduled = Boolean(
          m.isScheduled ||
          m.meetingType === 'scheduled' ||
          m.scheduledDate ||
          (m.scheduledTime && m.scheduledTime !== '')
        );
        return isScheduled && !isChatCall;
      });

      setMeetings(scheduledOnly.map((m) => {
        const startDate = m.startTime || m.scheduledDate || m.createdAt;
        const formattedDate = startDate
          ? new Date(startDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : 'N/A';
        const formattedTime = startDate
          ? new Date(startDate).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';

        let durationStr = `${m.duration || 30} mins`;
        if (m.startTime && m.endTime) {
          const diffMins = Math.round((new Date(m.endTime) - new Date(m.startTime)) / 60000);
          if (diffMins > 0) durationStr = `${diffMins} mins`;
        }

        const participantsCount = m.participantCount ?? (m.participants ? m.participants.length : 1);

        return {
          id: m.id || m._id || m.meetingId,
          meetingId: m.meetingId || m.roomId,
          roomId: m.meetingId || m.roomId,
          title: m.title || 'NEXORA Meeting',
          host: m.isHost ? 'You (Host)' : (m.hostName || 'Host'),
          date: formattedDate,
          time: formattedTime,
          duration: durationStr,
          participants: participantsCount,
          status: m.status || 'completed',
          recordingAvailable: Boolean(m.recordingAvailable)
        };
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load meeting history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopyLink = (roomId) => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = 'Title,Room ID,Date,Time,Duration,Host,Participants,Status\n';
    const rows = filteredMeetings
      .map(
        (m) =>
          `"${m.title}","${m.roomId}","${m.date}","${m.time}","${m.duration}","${m.host}","${m.participants}","${m.status}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-meeting-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.roomId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.host.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'completed') return m.status === 'completed' || m.status === 'ended';
    if (selectedFilter === 'missed') return m.status === 'missed' || m.status === 'cancelled';
    return m.status === selectedFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Meeting History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review past conference calls, attendees, duration summaries, and recordings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={isLoading} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={filteredMeetings.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV Report
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by topic, host, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-slate-850/80 border border-slate-200/90 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 shadow-subtle transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            All ({meetings.length})
          </button>
          <button
            onClick={() => setSelectedFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              selectedFilter === 'completed'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setSelectedFilter('missed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              selectedFilter === 'missed'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            Missed / Cancelled
          </button>
        </div>
      </div>

      {/* History Table Card */}
      <div className="rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-500" />
            <p className="text-xs">Loading meeting records from server...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 space-y-2">
            <p className="text-xs">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchHistory}>
              Try Again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-850/50">
                  <th className="py-3 px-6">Topic & Room ID</th>
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6">Duration</th>
                  <th className="py-3 px-6">Host & Attendees</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredMeetings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                          <Video className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          No Past Meetings Found
                        </h4>
                        <p className="text-xs text-slate-400">
                          {searchQuery
                            ? 'No meetings match your current search criteria.'
                            : 'Once you host or join calls, your completed meetings will appear here.'}
                        </p>
                        <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Start New Call
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMeetings.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition"
                    >
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {m.title}
                        </div>
                        <div className="font-mono text-[11px] text-brand-600 dark:text-brand-400 mt-0.5">
                          {m.roomId}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                        <div>{m.date}</div>
                        {m.time && <div className="text-[11px] text-slate-400">{m.time}</div>}
                      </td>

                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-medium">
                        {m.duration}
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {m.host}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" />
                          {m.participants} {m.participants === 1 ? 'attendee' : 'attendees'}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {m.status === 'completed' || m.status === 'ended' ? (
                          <Badge variant="success" size="sm" dot>
                            Completed
                          </Badge>
                        ) : m.status === 'active' ? (
                          <Badge variant="brand" size="sm" dot>
                            Active Now
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" dot>
                            {m.status === 'cancelled' ? 'Cancelled' : 'Missed'}
                          </Badge>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopyLink(m.roomId)}
                            title="Copy room link"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            {copiedId === m.roomId ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/meeting/${m.roomId}`)}
                            title="View Meeting Details & Insights"
                          >
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/room/${m.roomId}`)}
                            title="Re-open conference room"
                          >
                            Re-join
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingHistory;
