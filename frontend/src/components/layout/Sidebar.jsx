import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  UsersRound,
  PhoneCall,
  Settings,
  Bell,
  Calendar,
  Mail,
  Film,
  LogOut,
  PlusCircle,
  X,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Circle,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { notificationService } from '../../services/notificationService';
import Button from '../common/Button';
import NexoraLogo from '../common/NexoraLogo';

const PRESENCE_CONFIG = {
  available: { label: 'Available', dotClass: 'bg-emerald-500 fill-emerald-500 text-emerald-500' },
  busy: { label: 'Busy', dotClass: 'bg-rose-500 fill-rose-500 text-rose-500' },
  away: { label: 'Away', dotClass: 'bg-amber-500 fill-amber-500 text-amber-500' },
  offline: { label: 'Invisible / Offline', dotClass: 'bg-slate-400 fill-slate-400 text-slate-400' }
};

const PRESENCE_OPTIONS = [
  { id: 'available', label: 'Available', dotClass: 'bg-emerald-500 fill-emerald-500 text-emerald-500' },
  { id: 'busy', label: 'Busy', dotClass: 'bg-rose-500 fill-rose-500 text-rose-500' },
  { id: 'away', label: 'Away', dotClass: 'bg-amber-500 fill-amber-500 text-amber-500' },
  { id: 'offline', label: 'Invisible / Offline', dotClass: 'bg-slate-400 fill-slate-400 text-slate-400' }
];

const Sidebar = ({
  isMobileOpen,
  onCloseMobile,
  onOpenSchedule,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user, logout, updatePresenceStatus } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const presenceMenuRef = useRef(null);

  const currentPresence = user?.presenceStatus || localStorage.getItem('nexora_user_presence') || 'available';
  const activePresence = PRESENCE_CONFIG[currentPresence] || PRESENCE_CONFIG.available;

  // Close presence menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (presenceMenuRef.current && !presenceMenuRef.current.contains(e.target)) {
        setShowPresenceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresenceChange = async (newStatus) => {
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

  // On mobile overlay drawer, always render full expanded view
  const isCollapsedEffective = isCollapsed && !isMobileOpen;

  // Close on Escape key press and prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileOpen, onCloseMobile]);

  // Fetch unread notifications for the sidebar badge
  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications();
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        setUnreadCount(list.filter((n) => !n.isRead).length);
      }
    } catch {
      // Safe ignore
    }
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = () => setUnreadCount((c) => c + 1);
    socket.on('notification-received', handleNew);
    return () => socket.off('notification-received', handleNew);
  }, [socket]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Primary navigation matching requirements:
  // Dashboard, Messages, Contacts, Groups, Calls, and Settings
  const primaryNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    {
      label: 'Messages',
      path: '/messages',
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : null
    },
    { label: 'Contacts', path: '/contacts', icon: Users },
    { label: 'Groups', path: '/messages?tab=groups', icon: UsersRound },
    { label: 'Calls', path: '/history', icon: PhoneCall },
    { label: 'Settings', path: '/settings', icon: Settings }
  ];

  // Secondary tools (preserved functionality)
  const secondaryNavItems = [
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Invitations', path: '/invitations', icon: Mail },
    { label: 'Recordings', path: '/recordings', icon: Film },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null
    },
    ...(user?.role === 'admin'
      ? [{ label: 'Admin Center', path: '/admin', icon: ShieldCheck, badge: 'Admin' }]
      : [])
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 md:z-30 bg-white dark:bg-dark-900 border-r border-slate-200/80 dark:border-dark-750 flex flex-col transition-all duration-300 ease-in-out shadow-elevated md:shadow-none ${
          isCollapsed ? 'md:w-20' : 'md:w-64'
        } w-72 sm:w-80 max-w-[85vw] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 border-b border-slate-100 dark:border-dark-750 flex items-center px-3 shrink-0 ${
            isCollapsedEffective ? 'justify-between' : 'justify-between px-4'
          }`}
        >
          {isCollapsedEffective ? (
            <div className="w-full flex items-center justify-between">
              <div
                onClick={() => navigate('/dashboard')}
                className="cursor-pointer group select-none shrink-0"
                title="Go to Dashboard"
              >
                <NexoraLogo size="sm" withText={false} />
              </div>
              <button
                onClick={onToggleCollapse}
                title="Expand sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 hidden md:flex items-center justify-center cursor-pointer transition shrink-0"
              >
                <PanelLeftOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </button>
            </div>
          ) : (
            <>
              <div
                onClick={() => {
                  navigate('/dashboard');
                  onCloseMobile();
                }}
                className="flex items-center gap-3 cursor-pointer group select-none overflow-hidden"
              >
                <NexoraLogo size="md" withText={true} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleCollapse}
                  title="Collapse sidebar"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 hidden md:flex items-center justify-center cursor-pointer transition"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 md:hidden cursor-pointer"
                  title="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick Schedule Button */}
        {onOpenSchedule && (
          <div className={`p-2.5 shrink-0 ${isCollapsedEffective ? 'flex justify-center' : ''}`}>
            {isCollapsedEffective ? (
              <button
                onClick={onOpenSchedule}
                title="Schedule Meeting"
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 text-white flex items-center justify-center shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            ) : (
              <Button
                variant="gradient"
                size="sm"
                onClick={() => {
                  onOpenSchedule();
                  onCloseMobile();
                }}
                className="w-full text-xs font-semibold py-2.5 rounded-xl shadow-sm justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Schedule Meeting</span>
              </Button>
            )}
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 py-2 space-y-4 overflow-y-auto overflow-x-hidden min-h-0">
          {/* Primary Nav */}
          <div className="space-y-1">
            {!isCollapsedEffective && (
              <span className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Main Menu
              </span>
            )}
            {primaryNavItems.map((item) => {
              const isActive = (() => {
                if (item.path === '/dashboard') {
                  return (
                    location.pathname === '/dashboard' &&
                    !location.search.includes('tab=groups') &&
                    !location.search.includes('view=messages')
                  );
                }
                if (item.path === '/messages') {
                  return (
                    (location.pathname === '/messages' ||
                      (location.pathname === '/dashboard' &&
                        location.search.includes('view=messages'))) &&
                    !location.search.includes('tab=groups')
                  );
                }
                if (item.path === '/messages?tab=groups') {
                  return (
                    (location.pathname === '/messages' || location.pathname === '/dashboard') &&
                    location.search.includes('tab=groups')
                  );
                }
                if (item.path === '/history') {
                  return location.pathname === '/history';
                }
                return location.pathname === item.path;
              })();

              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onCloseMobile}
                  title={item.label + (item.badge ? ` (${item.badge})` : '')}
                  className={`group relative flex items-center ${
                    isCollapsedEffective
                      ? 'justify-center p-2.5 mx-1.5'
                      : 'justify-between px-3.5 py-2.5 mx-2'
                  } rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-500/10 via-violet-500/5 to-transparent dark:from-brand-500/20 dark:via-violet-500/10 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-500/30 shadow-subtle'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-dark-800/60 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {/* Distinctive NEXORA Active Pill Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-brand-500 via-indigo-500 to-violet-500 shadow-glow" />
                  )}

                  <div className={`flex items-center ${isCollapsedEffective ? 'justify-center' : 'gap-3 min-w-0'}`}>
                    <item.icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isActive
                          ? 'text-brand-600 dark:text-brand-400 scale-105'
                          : 'group-hover:scale-110 text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    {!isCollapsedEffective && <span className="truncate">{item.label}</span>}
                  </div>

                  {/* Small Notification Badge */}
                  {!isCollapsedEffective && item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 text-white min-w-[18px] text-center shadow-subtle shrink-0">
                      {item.badge}
                    </span>
                  )}

                  {/* Collapsed Badge Dot */}
                  {isCollapsedEffective && item.badge && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-dark-900" />
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Secondary Nav */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-dark-750">
            {!isCollapsedEffective && (
              <span className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Workspace Tools
              </span>
            )}
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={onCloseMobile}
                title={item.label + (item.badge ? ` (${item.badge})` : '')}
                className={({ isActive }) =>
                  `group relative flex items-center ${
                    isCollapsedEffective
                      ? 'justify-center p-2.5 mx-1.5'
                      : 'justify-between px-3.5 py-2 mx-2'
                  } rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-100/90 text-slate-900 font-semibold dark:bg-dark-800 dark:text-white border border-slate-200 dark:border-dark-750'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-dark-800/40 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                  }`
                }
              >
                <div className={`flex items-center ${isCollapsedEffective ? 'justify-center' : 'gap-3 min-w-0'}`}>
                  <item.icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:scale-105 transition-transform" />
                  {!isCollapsedEffective && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsedEffective && item.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* User Profile Section at Bottom */}
        <div
          ref={presenceMenuRef}
          className={`relative p-2.5 border-t border-slate-100 dark:border-dark-750 flex items-center shrink-0 ${
            isCollapsedEffective ? 'justify-center' : 'justify-between'
          }`}
        >
          {/* Presence Menu Popover (Opens upwards above profile footer) */}
          {showPresenceMenu && (
            <div
              className={`absolute bottom-full mb-2 bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-modal p-1.5 z-50 animate-fade-in text-xs w-48 ${
                isCollapsedEffective ? 'left-12' : 'left-2.5'
              }`}
            >
              <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Set Presence
              </div>
              {PRESENCE_OPTIONS.map((opt) => {
                const isSelected = currentPresence === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handlePresenceChange(opt.id)}
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

          <div
            className={`group relative flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-dark-800 transition ${
              isCollapsedEffective ? 'justify-center' : 'flex-1 min-w-0'
            }`}
          >
            {/* Avatar with live presence indicator (click to toggle presence menu) */}
            <div
              onClick={() => setShowPresenceMenu((prev) => !prev)}
              title={`Presence: ${activePresence.label} (Click to change)`}
              className="relative shrink-0 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 transition-colors ${
                  activePresence.dotClass.split(' ')[0]
                }`}
              />
            </div>

            {!isCollapsedEffective && (
              <div className="truncate flex-1 min-w-0">
                <div
                  onClick={() => {
                    navigate('/profile');
                    onCloseMobile();
                  }}
                  className="cursor-pointer"
                  title="View Profile"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate hover:text-brand-600 dark:hover:text-brand-400 transition">
                    {user?.name || 'User'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPresenceMenu((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition mt-0.5 cursor-pointer"
                  title="Click to set presence status"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                      activePresence.dotClass.split(' ')[0]
                    }`}
                  />
                  <span className="capitalize">{activePresence.label}</span>
                </button>
              </div>
            )}
          </div>

          {!isCollapsedEffective && (
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
