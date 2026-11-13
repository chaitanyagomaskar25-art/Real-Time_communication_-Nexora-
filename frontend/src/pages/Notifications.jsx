import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Mail,
  Phone,
  UserPlus,
  FolderUp,
  Calendar,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Inbox,
  Clock,
  Radio
} from 'lucide-react';
import Button from '../components/common/Button';
import { notificationService } from '../services/notificationService';
import { meetingService } from '../services/meetingService';
import { formatRelativeTime } from '../utils/formatters';
import { useSocket } from '../hooks/useSocket';

const Notifications = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'invites'

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications();
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        setNotifications(list);
      }
    } catch {
      // Safe ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time notification updates
  useEffect(() => {
    if (!socket) return;
    const handleNew = (notif) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => (n.id || n._id) !== (notif.id || notif._id))]);
    };
    socket.on('notification-received', handleNew);
    return () => socket.off('notification-received', handleNew);
  }, [socket]);

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => ((n.id || n._id) === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // Safe ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Safe ignore
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => (n.id || n._id) !== id));
    } catch {
      // Safe ignore
    }
  };

  const handleRsvp = async (notif, status) => {
    const meetingId = notif.data?.meetingId || notif.data?.roomId;
    if (!meetingId) return;
    try {
      await meetingService.rsvpInvitation(meetingId, status);
      await notificationService.markAsRead(notif.id || notif._id);
      setNotifications((prev) =>
        prev.map((n) => {
          if ((n.id || n._id) === (notif.id || notif._id)) {
            return {
              ...n,
              isRead: true,
              data: { ...n.data, status }
            };
          }
          return n;
        })
      );
    } catch (err) {
      console.error('RSVP error:', err);
    }
  };

  const handleAction = async (notif) => {
    await handleMarkRead(notif.id || notif._id);
    if (notif.type === 'meeting-invite') {
      if (notif.data?.meetingId) {
        navigate(`/room/${notif.data.meetingId}`);
      } else {
        navigate('/invitations');
      }
    } else if (notif.type === 'incoming-call' && notif.data?.meetingId) {
      navigate(`/room/${notif.data.meetingId}`);
    } else if (notif.type === 'contact-request') {
      navigate('/contacts');
    } else if (notif.type === 'meeting-reminder') {
      navigate(notif.data?.meetingId ? `/room/${notif.data.meetingId}` : '/calendar');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'meeting-invite':
        return Mail;
      case 'incoming-call':
        return Phone;
      case 'contact-request':
        return UserPlus;
      case 'file-share':
        return FolderUp;
      case 'meeting-reminder':
      default:
        return Calendar;
    }
  };

  const inviteCount = notifications.filter((n) => n.type === 'meeting-invite').length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'invites') return n.type === 'meeting-invite';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Notifications & Invitations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Manage your meeting invitations, call alerts, and activity updates in real time
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
            filter === 'all'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
            filter === 'unread'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('invites')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
            filter === 'invites'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Invitations
          {inviteCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
              {inviteCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-slate-850 flex items-center gap-3 animate-pulse"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {filter === 'unread'
                ? 'No unread notifications'
                : filter === 'invites'
                ? 'No meeting invitations'
                : 'No notifications yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You are all caught up! New invites, call alerts, and updates will appear here.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const IconComponent = getIcon(notif.type);
            const notifId = notif.id || notif._id;
            const isInvite = notif.type === 'meeting-invite';
            const isCall = notif.type === 'incoming-call';
            const isReminder = notif.type === 'meeting-reminder';
            const inviteStatus = notif.data?.status || 'pending';

            return (
              <div
                key={notifId}
                className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !notif.isRead
                    ? 'bg-brand-50/40 dark:bg-brand-950/20 border-brand-200/70 dark:border-brand-900/60 shadow-subtle'
                    : 'bg-white dark:bg-dark-900 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isInvite
                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400'
                        : isCall
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 animate-pulse'
                        : isReminder
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                        : !notif.isRead
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {notif.title || 'Notification'}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                      )}
                      {isInvite && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                          Meeting Invite
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 break-words leading-relaxed">
                      {notif.message || notif.content}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                      <span>{formatRelativeTime(notif.createdAt)}</span>
                      {(notif.data?.scheduledDate || notif.data?.scheduledTime) && (
                        <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {notif.data.scheduledDate ? new Date(notif.data.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          {notif.data.scheduledTime ? ` at ${notif.data.scheduledTime}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                  {isInvite ? (
                    inviteStatus === 'accepted' ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          ✓ Accepted
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/room/${notif.data?.meetingId || notif.data?.roomId}`)}
                        >
                          Join Room
                        </Button>
                      </div>
                    ) : inviteStatus === 'declined' ? (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Declined
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRsvp(notif, 'accepted')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRsvp(notif, 'declined')}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/room/${notif.data?.meetingId || notif.data?.roomId}`)}
                        >
                          Join
                        </Button>
                      </div>
                    )
                  ) : isCall ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAction(notif)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                    >
                      <Phone className="w-3.5 h-3.5 mr-1.5" />
                      Answer Call
                    </Button>
                  ) : isReminder ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAction(notif)}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Join Meeting
                    </Button>
                  ) : notif.type === 'contact-request' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAction(notif)}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      View Contacts
                    </Button>
                  ) : null}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkRead(notifId)}
                      title="Mark as read"
                      className="p-2 text-slate-400 hover:text-brand-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notifId)}
                    title="Delete notification"
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notifications;

