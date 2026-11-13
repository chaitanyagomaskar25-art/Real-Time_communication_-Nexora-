import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Video, X } from 'lucide-react';
import { meetingService } from '../../services/meetingService';
import { useSocket } from '../../hooks/useSocket';

const MeetingReminderBanner = () => {
  const [reminders, setReminders] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const navigate = useNavigate();
  const { socket } = useSocket();

  useEffect(() => {
    let isMounted = true;

    const fetchReminders = async () => {
      try {
        const res = await meetingService.getUpcomingReminders();
        const list = res?.data || res || [];
        if (isMounted && Array.isArray(list)) {
          setReminders(list);
        }
      } catch {
        // Safe ignore
      }
    };

    fetchReminders();
    const interval = setInterval(fetchReminders, 30000); // Check every 30 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Listen to socket reminder broadcasts
  useEffect(() => {
    if (!socket) return;

    const handleSocketReminder = (payload) => {
      setReminders((prev) => {
        if (prev.some((r) => r.meetingId === payload.meetingId)) return prev;
        return [payload, ...prev];
      });
    };

    socket.on('upcoming-meeting-reminder', handleSocketReminder);
    return () => {
      socket.off('upcoming-meeting-reminder', handleSocketReminder);
    };
  }, [socket]);

  const activeReminders = reminders.filter((r) => !dismissedIds.has(r.meetingId));

  if (activeReminders.length === 0) return null;

  const current = activeReminders[0];

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-brand-500/15 to-indigo-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 flex items-center justify-between z-30 animate-fade-in shadow-sm">
      <div className="flex items-center gap-2.5 truncate mr-3">
        <span className="p-1 rounded-lg bg-amber-500 text-slate-950 shrink-0 animate-bounce">
          <Bell className="w-3.5 h-3.5" />
        </span>
        <div className="truncate">
          <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">Upcoming Meeting Reminder:</span>
          <span className="font-semibold">{current.title}</span>
          <span className="text-slate-500 dark:text-slate-400 ml-2">
            {current.startsInMinutes <= 0
              ? 'Starting now'
              : `Starts in ${current.startsInMinutes} min${current.startsInMinutes > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate(`/room/${current.meetingId}`)}
          className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm text-xs"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Join Now</span>
        </button>
        <button
          onClick={() => setDismissedIds((prev) => new Set([...prev, current.meetingId]))}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          title="Dismiss Reminder"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MeetingReminderBanner;
