import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Video,
  Calendar,
  Phone,
  Mail,
  UserPlus,
  FolderUp,
  Circle,
  Sparkles,
  Check,
  Hash,
  ArrowRight,
  ClipboardPaste,
  X,
  LayoutDashboard,
  MessageSquare,
  Users,
  Film,
  Settings,
  User,
  Radio,
  Trash2,
  ExternalLink,
  Inbox,
  Clock,
  CheckCheck
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import Button from '../common/Button';
import NexoraLogo from '../common/NexoraLogo';
import { roomService } from '../../services/roomService';
import { notificationService } from '../../services/notificationService';
import { meetingService } from '../../services/meetingService';
import { formatRelativeTime } from '../../utils/formatters';
import SmartSearchModal from '../ai/SmartSearchModal';

const PRESENCE_OPTIONS = [
  { id: 'available', label: 'Available', dotClass: 'bg-emerald-500 fill-emerald-500 text-emerald-500' },
  { id: 'busy', label: 'Busy', dotClass: 'bg-rose-500 fill-rose-500 text-rose-500' },
  { id: 'away', label: 'Away', dotClass: 'bg-amber-500 fill-amber-500 text-amber-500' },
  { id: 'offline', label: 'Invisible / Offline', dotClass: 'bg-slate-400 fill-slate-400 text-slate-400' }
];

const TopHeader = ({ onToggleMobileSidebar, onOpenSchedule }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const { user, updatePresenceStatus } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all' | 'unread'
  const [isInstantStarting, setIsInstantStarting] = useState(false);
  const [isSmartSearchOpen, setIsSmartSearchOpen] = useState(false);

  // Join by code modal state
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const presenceMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const currentPresence = user?.presenceStatus || localStorage.getItem('nexora_user_presence') || 'available';

  // Dynamic active section breadcrumb helper
  const getSectionInfo = (pathname) => {
    if (pathname.startsWith('/dashboard')) return { title: 'Dashboard', icon: LayoutDashboard };
    if (pathname.startsWith('/messages')) return { title: 'Chat & Channels', icon: MessageSquare };
    if (pathname.startsWith('/calendar')) return { title: 'Calendar & Schedule', icon: Calendar };
    if (pathname.startsWith('/invitations')) return { title: 'Invitations', icon: Mail };
    if (pathname.startsWith('/contacts')) return { title: 'Contacts & Teams', icon: Users };
    if (pathname.startsWith('/recordings')) return { title: 'Recordings', icon: Film };
    if (pathname.startsWith('/settings')) return { title: 'Settings', icon: Settings };
    if (pathname.startsWith('/profile')) return { title: 'My Profile', icon: User };
    if (pathname.startsWith('/room')) return { title: 'Live Meeting', icon: Video };
    return { title: 'Workspace', icon: Sparkles };
  };

  const currentSection = getSectionInfo(location.pathname);

  // Click outside listener to dismiss menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (presenceMenuRef.current && !presenceMenuRef.current.contains(e.target)) {
        setShowPresenceMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut for Smart Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSmartSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch real notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications();
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        setNotifications(list);
      }
    } catch {
      // Safe ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen to live socket notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
    };

    socket.on('notification-received', handleNewNotification);
    return () => {
      socket.off('notification-received', handleNewNotification);
    };
  }, [socket]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Safe ignore
    }
  };

  const handleRsvp = async (notif, status, e) => {
    if (e) e.stopPropagation();
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

  const handleDeleteNotification = async (notifId, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.deleteNotification(notifId);
      setNotifications((prev) => prev.filter((n) => (n.id || n._id) !== notifId));
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      await notificationService.markAsRead(notif.id || notif._id);
      setNotifications((prev) =>
        prev.map((n) => ((n.id || n._id) === (notif.id || notif._id) ? { ...n, isRead: true } : n))
      );
    } catch {
      // Safe ignore
    }

    setShowNotifications(false);
    if (notif.type === 'meeting-invite') {
      navigate('/invitations');
    } else if (notif.type === 'incoming-call' && notif.data?.meetingId) {
      navigate(`/room/${notif.data.meetingId}`);
    } else if (notif.type === 'contact-request') {
      navigate('/contacts');
    } else if (notif.type === 'meeting-reminder') {
      navigate(notif.data?.meetingId ? `/room/${notif.data.meetingId}` : '/calendar');
    }
  };

  const handleStatusChange = async (newStatus) => {
    setShowPresenceMenu(false);
    try {
      if (updatePresenceStatus) {
        await updatePresenceStatus(newStatus);
      }
      if (socket) {
        socket.emit('update-presence-status', { status: newStatus });
      }
    } catch {
      // Safe ignore
    }
  };

  const handleStartInstant = async () => {
    setIsInstantStarting(true);
    try {
      const room = await roomService.createRoom(`${user?.name || user?.fullName || 'Quick'}'s Meeting`);
      navigate(`/room/${room.roomId}`);
    } catch {
      const fallbackId = Math.random().toString(36).substring(2, 9);
      navigate(`/room/${fallbackId}`);
    } finally {
      setIsInstantStarting(false);
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const cleaned = roomCodeInput.trim();
    if (!cleaned) {
      setJoinError('Please enter a room code');
      return;
    }
    let roomId = cleaned;
    if (cleaned.includes('/room/')) {
      roomId = cleaned.split('/room/')[1].split('?')[0].split('#')[0];
    } else if (cleaned.startsWith('http')) {
      const parts = cleaned.split('/');
      roomId = parts[parts.length - 1];
    }
    setIsJoinModalOpen(false);
    setRoomCodeInput('');
    setJoinError('');
    navigate(`/room/${roomId}`);
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomCodeInput(text.trim());
        setJoinError('');
      }
    } catch {
      // Safe fallback if clipboard permission isn't granted
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'busy':
      case 'in-meeting':
        return 'bg-rose-500 text-rose-500';
      case 'away':
        return 'bg-amber-500 text-amber-500';
      case 'offline':
        return 'bg-slate-400 text-slate-400';
      case 'available':
      default:
        return 'bg-emerald-500 text-emerald-500';
    }
  };

  const getNotificationIcon = (type) => {
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

  return (
    <header className="h-16 px-4 sm:px-6 bg-white/90 dark:bg-dark-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile hamburger, Logo, Modern Workspace Breadcrumb + Quick Join */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div onClick={() => navigate('/dashboard')} className="cursor-pointer md:hidden shrink-0">
          <NexoraLogo size="xs" withText={true} />
        </div>

        {/* Modern Workspace & Active Route Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-xs backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-tight">Nexora</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5">
            <currentSection.icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{currentSection.title}</span>
          </span>
        </div>

        {/* Modern Join by Room Code Button */}
        <button
          type="button"
          onClick={() => setIsJoinModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-subtle cursor-pointer group shrink-0"
          title="Join a call with room code or meeting link"
        >
          <Hash className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 group-hover:rotate-12 transition-transform" />
          <span>Join by Code</span>
        </button>
      </div>

      {/* Right: Modern Actions, Realtime Pill, Theme, Notifications, Presence */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Real-time Live Status Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Real-Time</span>
        </div>

        {/* Schedule Meeting Button */}
        {onOpenSchedule && (
          <button
            onClick={onOpenSchedule}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-subtle cursor-pointer"
            title="Schedule a new meeting"
          >
            <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Schedule</span>
          </button>
        )}

        {/* Quick Instant Meeting Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleStartInstant}
          isLoading={isInstantStarting}
          className="hidden sm:inline-flex"
        >
          <Video className="w-3.5 h-3.5 mr-1.5" />
          Instant Call
        </Button>

        {/* Theme Toggle Button (Pure Light <-> Dark) */}
        <button
          onClick={toggleTheme}
          title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform duration-200" />
          )}
        </button>

        {/* Notifications Button & Dropdown */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            title="Notifications"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-850 transition relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-brand-600 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-dark-900" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 sm:w-[420px] bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-modal p-3.5 z-50 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600 text-white font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-100/80 dark:border-slate-800/60">
                <button
                  onClick={() => setNotificationFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    notificationFilter === 'all'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotificationFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    notificationFilter === 'unread'
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Unread
                  {unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Scrollable List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-0.5">
                {notifications.filter((n) => (notificationFilter === 'unread' ? !n.isRead : true)).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {notificationFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      You are all caught up! New invites and alerts will appear here.
                    </p>
                  </div>
                ) : (
                  notifications
                    .filter((n) => (notificationFilter === 'unread' ? !n.isRead : true))
                    .map((n) => {
                      const IconComp = getNotificationIcon(n.type);
                      const notifId = n.id || n._id;
                      const isInvite = n.type === 'meeting-invite';
                      const isCall = n.type === 'incoming-call';
                      const isReminder = n.type === 'meeting-reminder';
                      const inviteStatus = n.data?.status || 'pending';

                      // Badge color scheme
                      let iconBg = 'bg-brand-100 text-brand-600 dark:bg-brand-950/80 dark:text-brand-400';
                      if (isInvite) iconBg = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400';
                      if (isCall) iconBg = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 animate-pulse';
                      if (isReminder) iconBg = 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400';

                      return (
                        <div
                          key={notifId}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 rounded-2xl transition border cursor-pointer relative group ${
                            !n.isRead
                              ? 'bg-brand-50/40 dark:bg-brand-950/25 border-brand-200/70 dark:border-brand-900/50 shadow-subtle'
                              : 'bg-white dark:bg-dark-850 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-200/70 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                              <IconComp className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {n.title}
                                </h4>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                    {formatRelativeTime(n.createdAt)}
                                  </span>
                                  {!n.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
                                {n.message}
                              </p>

                              {/* Scheduled Meeting Info if available */}
                              {(n.data?.scheduledDate || n.data?.scheduledTime) && (
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {n.data.scheduledDate ? new Date(n.data.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                    {n.data.scheduledTime ? ` at ${n.data.scheduledTime}` : ''}
                                  </span>
                                </div>
                              )}

                              {/* Actionable buttons for Invitations & Calls */}
                              <div className="mt-2.5 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                {isInvite && (
                                  <>
                                    {inviteStatus === 'accepted' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                          ✓ Accepted
                                        </span>
                                        <button
                                          onClick={() => {
                                            setShowNotifications(false);
                                            navigate(`/room/${n.data?.meetingId || n.data?.roomId}`);
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                                        >
                                          Join Room
                                        </button>
                                      </div>
                                    ) : inviteStatus === 'declined' ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        Declined
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={(e) => handleRsvp(n, 'accepted', e)}
                                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                                        >
                                          <Check className="w-3 h-3" />
                                          Accept
                                        </button>
                                        <button
                                          onClick={(e) => handleRsvp(n, 'declined', e)}
                                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-300 text-[11px] font-semibold transition"
                                        >
                                          Decline
                                        </button>
                                        <button
                                          onClick={() => {
                                            setShowNotifications(false);
                                            navigate(`/room/${n.data?.meetingId || n.data?.roomId}`);
                                          }}
                                          className="px-2 py-1 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-[11px] font-semibold transition flex items-center gap-0.5"
                                        >
                                          Join
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}

                                {isCall && (
                                  <button
                                    onClick={() => {
                                      setShowNotifications(false);
                                      navigate(`/room/${n.data?.meetingId || n.data?.roomId}`);
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition animate-pulse"
                                  >
                                    <Phone className="w-3 h-3" />
                                    Answer Call
                                  </button>
                                )}

                                {isReminder && (
                                  <button
                                    onClick={() => {
                                      setShowNotifications(false);
                                      navigate(n.data?.meetingId ? `/room/${n.data.meetingId}` : '/calendar');
                                    }}
                                    className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                                  >
                                    Join Meeting
                                  </button>
                                )}

                                {n.type === 'contact-request' && (
                                  <button
                                    onClick={() => {
                                      setShowNotifications(false);
                                      navigate('/contacts');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                                  >
                                    View Requests
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Dismiss / Delete Button */}
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => handleDeleteNotification(notifId, e)}
                                title="Dismiss notification"
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Dropdown Footer: Link to full notifications page */}
              <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-2 text-center text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>View all notifications</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Presence Status Selector & User Avatar */}
        <div className="relative" ref={presenceMenuRef}>
          <div
            onClick={() => setShowPresenceMenu((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={`Presence: ${currentPresence.charAt(0).toUpperCase() + currentPresence.slice(1)} (Click to change)`}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name || user?.fullName ? (user.name || user.fullName).charAt(0).toUpperCase() : 'U'}
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 transition-colors ${
                  getStatusColor(currentPresence).split(' ')[0]
                }`}
              />
            </div>
          </div>

          {showPresenceMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-modal p-1.5 z-50 animate-fade-in text-xs">
              <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Set Presence
              </div>
              {PRESENCE_OPTIONS.map((opt) => {
                const isSelected = currentPresence === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleStatusChange(opt.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2.5 h-2.5 ${opt.dotClass}`} />
                      <span className="text-slate-800 dark:text-slate-200">{opt.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modern Join by Code Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsJoinModalOpen(false);
                setJoinError('');
              }}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/60 dark:border-brand-800/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Join a Meeting
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter a room code or paste an invitation link
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. nex-8821 or meeting link"
                    value={roomCodeInput}
                    onChange={(e) => {
                      setRoomCodeInput(e.target.value);
                      if (joinError) setJoinError('');
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-850 border ${
                      joinError
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'
                    } rounded-xl px-4 py-2.5 pr-20 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition outline-none font-medium`}
                  />
                  <button
                    type="button"
                    onClick={handlePasteCode}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 transition cursor-pointer flex items-center gap-1"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Paste</span>
                  </button>
                </div>
                {joinError && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{joinError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsJoinModalOpen(false);
                    setJoinError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                >
                  <span>Join Meeting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global AI Smart Search Modal */}
      <SmartSearchModal
        isOpen={isSmartSearchOpen}
        onClose={() => setIsSmartSearchOpen(false)}
      />
    </header>
  );
};

export default TopHeader;
