import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  Globe,
  Users,
  Repeat,
  Lock,
  Edit,
  Copy,
  Check,
  Filter
} from 'lucide-react';
import Button from '../components/common/Button';
import ScheduleMeetingModal from '../components/meetings/ScheduleMeetingModal';
import EditMeetingModal from '../components/meetings/EditMeetingModal';
import { meetingService } from '../services/meetingService';
import { useAuth } from '../hooks/useAuth';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Calendar view mode: 'month' | 'week' | 'day'
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  );
  const [filterType, setFilterType] = useState('all'); // 'all' | 'hosted' | 'invited'

  // Data
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState(null);
  const [selectedMeetingForEdit, setSelectedMeetingForEdit] = useState(null);
  const [selectedMeetingForDetail, setSelectedMeetingForDetail] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Fetch calendar meetings
  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date window (start of month - 7 days, end of month + 7 days)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month - 1, 20).toISOString();
      const end = new Date(year, month + 2, 10).toISOString();

      const res = await meetingService.getCalendarMeetings({
        start,
        end,
        timezone: selectedTimezone
      });

      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        setMeetings(list);
      }
    } catch (err) {
      console.warn('Failed to fetch calendar meetings:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, selectedTimezone]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Navigate dates
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate((prev) => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentDate((prev) => new Date(prev.getTime() - 24 * 60 * 60 * 1000));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate((prev) => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentDate((prev) => new Date(prev.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter meetings by role
  const filteredMeetings = useMemo(() => {
    const currentUserId = user?.id || user?._id;
    const currentUserEmail = user?.email?.toLowerCase().trim();

    return meetings.filter((m) => {
      const isHost = (currentUserId && m.host === currentUserId) || m.isHost;
      const isInvited = currentUserEmail && m.invitees?.some((inv) => (typeof inv === 'string' ? inv : inv.email) === currentUserEmail);

      if (filterType === 'hosted') return isHost;
      if (filterType === 'invited') return isInvited;
      return true;
    });
  }, [meetings, filterType, user]);

  // Format header title
  const calendarHeaderTitle = useMemo(() => {
    const options = { month: 'long', year: 'numeric' };
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', options);
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    // Week range
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [currentDate, viewMode]);

  // Helpers for Monthly View Grid
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid = [];

    // Previous month filler days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      grid.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      grid.push({ date: d, isCurrentMonth: true });
    }

    // Next month filler days to complete 35 or 42 cells
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      grid.push({ date: d, isCurrentMonth: false });
    }

    return grid;
  }, [currentDate]);

  // Helper to check if a meeting falls on a given date (formatted YYYY-MM-DD in local time)
  const getMeetingsForDay = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const targetYMD = `${year}-${month}-${day}`;

    return filteredMeetings.filter((m) => {
      const start = m.startTime || m.scheduledDate;
      if (!start) return false;
      const mDate = new Date(start);
      const mYMD = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(mDate.getDate()).padStart(2, '0')}`;
      return mYMD === targetYMD;
    });
  };

  // Week days
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(curr.getFullYear(), curr.getMonth(), first + i));
    }
    return days;
  }, [currentDate]);

  const handleCopyLink = (m, e) => {
    if (e) e.stopPropagation();
    const link = m.inviteLink || `${window.location.origin}/room/${m.meetingId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(m.meetingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isToday = (dateObj) => {
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Top Header / Action Toolbar */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Navigation */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {calendarHeaderTitle}
                </h1>
                <span className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  {selectedTimezone}
                </span>
                {isLoading && (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium animate-pulse">
                    Syncing...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage upcoming schedule, recurrent conferences & invitations
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-dark-950 text-slate-900 dark:text-white shadow-subtle'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-white dark:bg-dark-950 text-slate-900 dark:text-white shadow-subtle'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'day'
                    ? 'bg-white dark:bg-dark-950 text-slate-900 dark:text-white shadow-subtle'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Day
              </button>
            </div>

            {/* Schedule New Meeting Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPrefillDate(new Date().toISOString().split('T')[0]);
                setIsScheduleOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Schedule Meeting
            </Button>
          </div>
        </div>

        {/* Second Row: Navigation Controls & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Previous / Today / Next */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-lg border border-slate-200/90 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filters: All, Hosted, Invited */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All ({meetings.length})
            </button>
            <button
              onClick={() => setFilterType('hosted')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'hosted'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Hosted by Me
            </button>
            <button
              onClick={() => setFilterType('invited')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filterType === 'invited'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Invitations
            </button>
          </div>
        </div>
      </div>

      {/* 1. MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <div className="min-w-[640px] sm:min-w-0">
          {/* Day Headers (Sun - Sat) */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-dark-950/60 text-center py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-800">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const dayMeetings = getMeetingsForDay(date);
              const dateStr = date.toISOString().split('T')[0];
              const today = isToday(date);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setPrefillDate(dateStr);
                    setIsScheduleOpen(true);
                  }}
                  className={`min-h-[110px] sm:min-h-[125px] p-1.5 sm:p-2 transition group flex flex-col justify-between cursor-pointer ${
                    isCurrentMonth
                      ? 'bg-white dark:bg-dark-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'bg-slate-50/40 dark:bg-dark-950/40 text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block ${
                        today
                          ? 'bg-brand-600 text-white font-bold'
                          : isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {/* Quick plus on hover */}
                    <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-500 p-0.5 transition">
                      <Plus className="w-3 h-3" />
                    </span>
                  </div>

                  {/* Day Meetings Stack */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-none">
                    {dayMeetings.slice(0, 3).map((m) => {
                      const isHost = m.isHost || m.host === (user?.id || user?._id);
                      return (
                        <div
                          key={m.id || m.meetingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMeetingForDetail(m);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold truncate flex items-center justify-between border transition shadow-xs ${
                            isHost
                              ? 'bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800/80 hover:bg-brand-100'
                              : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100'
                          }`}
                          title={`${m.title} (${m.scheduledTime || ''})`}
                        >
                          <span className="truncate">{m.title}</span>
                          <span className="text-[9px] opacity-75 shrink-0 ml-1">
                            {m.scheduledTime ? m.scheduledTime.split(' ')[0] : ''}
                          </span>
                        </div>
                      );
                    })}

                    {dayMeetings.length > 3 && (
                      <div className="text-[10px] text-slate-400 font-semibold px-1">
                        +{dayMeetings.length - 3} more
                      </div>
                    )}
                  </div>

                  <div />
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* 2. WEEKLY VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <div className="min-w-[640px] sm:min-w-0">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-dark-950/60 text-center py-3 text-xs divide-x divide-slate-200 dark:divide-slate-800">
            {weekDays.map((d, i) => {
              const today = isToday(d);
              return (
                <div key={i} className="space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                    {DAYS_OF_WEEK[d.getDay()]}
                  </div>
                  <div
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      today ? 'bg-brand-600 text-white' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week Columns */}
          <div className="grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800 min-h-[450px]">
            {weekDays.map((d, idx) => {
              const dayMeetings = getMeetingsForDay(d);
              const dateStr = d.toISOString().split('T')[0];

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setPrefillDate(dateStr);
                    setIsScheduleOpen(true);
                  }}
                  className="p-2 space-y-2 bg-white dark:bg-dark-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition cursor-pointer"
                >
                  {dayMeetings.map((m) => (
                    <div
                      key={m.id || m.meetingId}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMeetingForDetail(m);
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-brand-500 transition space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1 font-bold text-brand-600 dark:text-brand-400">
                          <Clock className="w-3 h-3" />
                          {m.scheduledTime || 'TBD'}
                        </span>
                        <span>{m.duration}m</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {m.title}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/room/${m.meetingId}`);
                          }}
                          className="px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-semibold transition"
                        >
                          Join
                        </button>
                        <button
                          onClick={(e) => handleCopyLink(m, e)}
                          className="text-slate-400 hover:text-slate-200 p-1"
                          title="Copy Link"
                        >
                          {copiedId === m.meetingId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {dayMeetings.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-400 text-[11px] py-10 opacity-40">
                      No events
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* 3. DAILY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Schedule for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">
                {getMeetingsForDay(currentDate).length} meeting(s) scheduled for this day
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPrefillDate(currentDate.toISOString().split('T')[0]);
                setIsScheduleOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Event
            </Button>
          </div>

          <div className="space-y-3">
            {getMeetingsForDay(currentDate).map((m) => {
              const isHost = m.isHost || m.host === (user?.id || user?._id);
              return (
                <div
                  key={m.id || m.meetingId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-brand-500/50 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {m.scheduledTime || '10:00 AM'} ({m.duration} mins)
                      </span>
                      {isHost && (
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase">
                          Host
                        </span>
                      )}
                      {m.recurrence && m.recurrence.type !== 'none' && (
                        <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Repeat className="w-3 h-3" /> {m.recurrence.type}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{m.title}</h4>
                    {m.description && <p className="text-xs text-slate-600 dark:text-slate-300">{m.description}</p>}
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Host: {m.hostName}</span>
                      <span>•</span>
                      <span>Code: <code className="font-mono text-slate-300">{m.meetingId}</code></span>
                      {m.invitees && m.invitees.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{m.invitees.length} Invitee(s)</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/room/${m.meetingId}`)}
                    >
                      <Video className="w-3.5 h-3.5 mr-1.5" />
                      Join Call
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleCopyLink(m, e)}
                    >
                      {copiedId === m.meetingId ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedId === m.meetingId ? 'Copied' : 'Invite'}
                    </Button>
                    {isHost && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedMeetingForEdit(m)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {getMeetingsForDay(currentDate).length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto opacity-30 text-brand-500" />
                <p>No meetings scheduled for this day.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrefillDate(currentDate.toISOString().split('T')[0]);
                    setIsScheduleOpen(true);
                  }}
                >
                  Schedule an Event
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick View / Detail Modal */}
      {selectedMeetingForDetail && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMeetingForDetail(null)}
        >
          <div
            className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-xs animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 px-2 py-0.5 rounded">
                Meeting Details
              </span>
              <button
                onClick={() => setSelectedMeetingForDetail(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedMeetingForDetail.title}
              </h3>
              {selectedMeetingForDetail.description && (
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  {selectedMeetingForDetail.description}
                </p>
              )}
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                <span>
                  {selectedMeetingForDetail.scheduledTime || '10:00 AM'} ({selectedMeetingForDetail.duration} mins)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-brand-500" />
                <span>Timezone: {selectedMeetingForDetail.timezone || selectedTimezone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-brand-500" />
                <span>Host: {selectedMeetingForDetail.hostName}</span>
              </div>
              {selectedMeetingForDetail.isPasswordProtected && (
                <div className="flex items-center gap-2 text-amber-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password Protected Meeting</span>
                </div>
              )}
            </div>

            {/* Invitees List */}
            {selectedMeetingForDetail.invitees && selectedMeetingForDetail.invitees.length > 0 && (
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Attendees ({selectedMeetingForDetail.invitees.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedMeetingForDetail.invitees.map((inv, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      {typeof inv === 'string' ? inv : inv.email}
                      {inv.status && ` (${inv.status})`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {(selectedMeetingForDetail.isHost || selectedMeetingForDetail.host === (user?.id || user?._id)) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const m = selectedMeetingForDetail;
                      setSelectedMeetingForDetail(null);
                      setSelectedMeetingForEdit(m);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleCopyLink(selectedMeetingForDetail, e)}
                >
                  {copiedId === selectedMeetingForDetail.meetingId ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedId === selectedMeetingForDetail.meetingId ? 'Copied' : 'Invite'}
                </Button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/room/${selectedMeetingForDetail.meetingId}`)}
              >
                <Video className="w-3.5 h-3.5 mr-1" />
                Join
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        initialDate={prefillDate}
        onScheduled={() => {
          fetchCalendar();
        }}
      />

      {/* Edit Meeting Modal */}
      {selectedMeetingForEdit && (
        <EditMeetingModal
          isOpen={Boolean(selectedMeetingForEdit)}
          onClose={() => setSelectedMeetingForEdit(null)}
          meeting={selectedMeetingForEdit}
          onUpdated={() => {
            fetchCalendar();
          }}
          onCancelled={() => {
            fetchCalendar();
          }}
        />
      )}
    </div>
  );
};

export default CalendarPage;
