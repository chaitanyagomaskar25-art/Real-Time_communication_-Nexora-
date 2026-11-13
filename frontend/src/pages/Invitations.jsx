import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Check,
  X,
  Clock,
  Video,
  Copy,
  Calendar,
  Globe,
  Lock,
  Shield,
  Repeat,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { meetingService } from '../services/meetingService';
import { useAuth } from '../hooks/useAuth';

const Invitations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'accepted' | 'declined'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await meetingService.getUserInvitations();
      const list = res?.data || res || [];
      setInvitations(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load meeting invitations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRSVP = async (meetingId, status) => {
    setActionLoadingId(meetingId);
    try {
      await meetingService.rsvpInvitation(meetingId, status);
      // Update local state directly for instantaneous feedback
      setInvitations((prev) =>
        prev.map((item) => {
          if (item.meetingId === meetingId) {
            return {
              ...item,
              myRsvpStatus: status,
              invitees: item.invitees?.map((inv) =>
                inv.email?.toLowerCase() === user?.email?.toLowerCase()
                  ? { ...inv, status, respondedAt: new Date().toISOString() }
                  : inv
              )
            };
          }
          return item;
        })
      );
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update RSVP status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyInvite = (meeting) => {
    const inviteUrl = `${window.location.origin}/room/${meeting.meetingId}`;
    const inviteText = `Join my NEXORA Meeting:
Topic: ${meeting.title}
Date & Time: ${formatDate(meeting.startTime, meeting.timezone)}
Join Link: ${inviteUrl}
Meeting ID: ${meeting.meetingId}${meeting.password ? `\nPasscode Required` : ''}`;

    navigator.clipboard.writeText(inviteText).then(() => {
      setCopiedId(meeting.meetingId);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const formatDate = (dateString, timezone) => {
    if (!dateString) return 'TBD';
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('default', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: timezone || undefined
      }).format(d);
    } catch {
      return new Date(dateString).toLocaleString();
    }
  };

  // Filter list
  const filteredInvitations = useMemo(() => {
    return invitations.filter((item) => {
      // RSVP tab filter
      const userStatus = item.myRsvpStatus || 'pending';
      if (filterTab !== 'all' && userStatus !== filterTab) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        const hostMatch =
          item.host?.name?.toLowerCase().includes(query) ||
          item.host?.email?.toLowerCase().includes(query);
        return titleMatch || descMatch || hostMatch;
      }

      return true;
    });
  }, [invitations, filterTab, searchQuery]);

  const counts = useMemo(() => {
    const all = invitations.length;
    const pending = invitations.filter((i) => (i.myRsvpStatus || 'pending') === 'pending').length;
    const accepted = invitations.filter((i) => i.myRsvpStatus === 'accepted').length;
    const declined = invitations.filter((i) => i.myRsvpStatus === 'declined').length;
    return { all, pending, accepted, declined };
  }, [invitations]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Meeting Invitations
            </h1>
            <Badge variant="primary" size="sm">
              {invitations.length} Total
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and RSVP to upcoming video conferences you have been invited to.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvitations}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/calendar')}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Open Calendar</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-900 p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-card">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'all'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Pending</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
              {counts.pending}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('accepted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'accepted'
                ? 'bg-emerald-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Accepted</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
              {counts.accepted}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('declined')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'declined'
                ? 'bg-rose-600 text-white shadow-subtle'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Declined</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
              {counts.declined}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invitations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInvitations}>
            Try Again
          </Button>
        </div>
      )}

      {/* Invitations List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
              <div className="h-4 w-64 bg-slate-100 dark:bg-slate-850 rounded" />
              <div className="h-10 w-full bg-slate-100 dark:bg-slate-850 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredInvitations.length === 0 ? (
        <div className="bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-200/50 dark:border-brand-800/50">
            <Mail className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery
              ? 'No matching invitations found'
              : filterTab === 'all'
              ? 'No meeting invitations yet'
              : `No ${filterTab} invitations`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search keywords or clear the filter.'
              : 'When colleagues invite you to NEXORA video meetings, their invites will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInvitations.map((meeting) => {
            const myStatus = meeting.myRsvpStatus || 'pending';
            const isCancelled = meeting.status === 'cancelled';
            const isCompleted = meeting.status === 'ended';
            const isWorking = actionLoadingId === meeting.meetingId;

            return (
              <div
                key={meeting.meetingId}
                className={`bg-white dark:bg-dark-900 rounded-2xl border p-5 transition shadow-xs flex flex-col justify-between ${
                  isCancelled
                    ? 'border-slate-200 dark:border-slate-800 opacity-60'
                    : myStatus === 'accepted'
                    ? 'border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-300'
                    : myStatus === 'declined'
                    ? 'border-rose-200/80 dark:border-rose-900/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Bar: Title & RSVP Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                        {meeting.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Hosted by{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {meeting.host?.name || meeting.host?.email || 'Organizer'}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isCancelled ? (
                        <Badge variant="danger" size="sm">
                          Cancelled
                        </Badge>
                      ) : isCompleted ? (
                        <Badge variant="default" size="sm">
                          Ended
                        </Badge>
                      ) : myStatus === 'accepted' ? (
                        <Badge variant="success" size="sm" dot>
                          Accepted
                        </Badge>
                      ) : myStatus === 'declined' ? (
                        <Badge variant="danger" size="sm" dot>
                          Declined
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm" dot>
                          Pending RSVP
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description if present */}
                  {meeting.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 bg-slate-50 dark:bg-slate-850/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {meeting.description}
                    </p>
                  )}

                  {/* Date, Time & Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span className="truncate">
                        {formatDate(meeting.startTime, meeting.timezone)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{meeting.durationMinutes || 30} mins</span>
                    </div>
                  </div>

                  {/* Badges / Feature Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {meeting.timezone && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {meeting.timezone}
                      </span>
                    )}

                    {meeting.recurrence && meeting.recurrence.type !== 'none' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-[10px] text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50 dark:border-purple-800/50">
                        <Repeat className="w-3 h-3" />
                        Recurring ({meeting.recurrence.type})
                      </span>
                    )}

                    {meeting.password && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-[10px] text-amber-700 dark:text-amber-300 font-medium border border-amber-200/50 dark:border-amber-800/50">
                        <Lock className="w-3 h-3" />
                        Password
                      </span>
                    )}

                    {meeting.settings?.waitingRoomEnabled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-[10px] text-cyan-700 dark:text-cyan-300 font-medium border border-cyan-200/50 dark:border-cyan-800/50">
                        <Shield className="w-3 h-3" />
                        Waiting Room
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  {/* RSVP Buttons */}
                  {!isCancelled && !isCompleted && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={myStatus === 'accepted' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleRSVP(meeting.meetingId, 'accepted')}
                        disabled={isWorking}
                        className={`text-xs px-2.5 py-1 ${
                          myStatus === 'accepted'
                            ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white'
                            : 'hover:text-emerald-600 hover:border-emerald-300'
                        }`}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        <span>{myStatus === 'accepted' ? 'Accepted' : 'Accept'}</span>
                      </Button>

                      <Button
                        variant={myStatus === 'declined' ? 'danger' : 'outline'}
                        size="sm"
                        onClick={() => handleRSVP(meeting.meetingId, 'declined')}
                        disabled={isWorking}
                        className={`text-xs px-2.5 py-1 ${
                          myStatus === 'declined'
                            ? '!bg-rose-600 hover:!bg-rose-700 !text-white'
                            : 'hover:text-rose-600 hover:border-rose-300'
                        }`}
                      >
                        <X className="w-3 h-3 mr-1" />
                        <span>{myStatus === 'declined' ? 'Declined' : 'Decline'}</span>
                      </Button>
                    </div>
                  )}

                  {/* Join & Copy Link */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleCopyInvite(meeting)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Copy meeting invite"
                    >
                      {copiedId === meeting.meetingId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => navigate(`/meeting/${meeting.meetingId}`)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="View meeting details"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {!isCancelled && !isCompleted && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/room/${meeting.meetingId}`)}
                        className="text-xs px-3 py-1 flex items-center gap-1 shadow-sm"
                      >
                        <Video className="w-3 h-3" />
                        <span>Join</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Invitations;

