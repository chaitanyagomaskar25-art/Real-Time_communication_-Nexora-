import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Video,
  PhoneCall,
  Settings,
  Plus
} from 'lucide-react';

const MobileBottomNav = ({ onOpenSchedule, onStartInstant, unreadCount = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const isMessagesActive =
    location.pathname === '/messages' ||
    location.search.includes('view=messages');

  const isDashboardActive =
    location.pathname === '/dashboard' &&
    !location.search.includes('view=messages') &&
    !location.search.includes('tab=groups');

  const navItems = [
    {
      label: 'Home',
      path: '/dashboard',
      icon: LayoutDashboard,
      isActive: isDashboardActive
    },
    {
      label: 'Chats',
      path: '/messages',
      icon: MessageSquare,
      isActive: isMessagesActive,
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      isCenter: true
    },
    {
      label: 'Calls',
      path: '/history',
      icon: PhoneCall,
      isActive: location.pathname === '/history'
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      isActive: location.pathname === '/settings' || location.pathname === '/profile'
    }
  ];

  return (
    <>
      {/* Quick Meeting Action Sheet Modal for Mobile Center Button */}
      {showQuickMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setShowQuickMenu(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 shadow-2xl p-5 space-y-3 z-10 animate-slide-up">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-dark-700 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white text-center">
              Quick Meeting Actions
            </h3>

            <button
              onClick={() => {
                setShowQuickMenu(false);
                if (onStartInstant) onStartInstant();
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 text-white font-semibold text-xs shadow-md shadow-brand-500/20 active:scale-[0.98] transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-bold">Start Instant Meeting</div>
                <div className="text-[10px] text-white/80 font-normal">Launch an encrypted WebRTC room</div>
              </div>
            </button>

            {onOpenSchedule && (
              <button
                onClick={() => {
                  setShowQuickMenu(false);
                  onOpenSchedule();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-dark-800 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:bg-slate-200/80 dark:hover:bg-dark-750 active:scale-[0.98] transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-dark-700 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-bold">Schedule a Meeting</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Set calendar date, time & invite peers</div>
                </div>
              </button>
            )}

            <button
              onClick={() => setShowQuickMenu(false)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-dark-750 md:hidden pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-lg select-none"
      >
        <div className="grid grid-cols-5 items-center h-14 px-2">
          {navItems.map((item, idx) => {
            if (item.isCenter) {
              return (
                <div key="center-btn" className="flex items-center justify-center -mt-5">
                  <button
                    type="button"
                    onClick={() => setShowQuickMenu(true)}
                    title="Quick Action"
                    className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer border-2 border-white dark:border-dark-900"
                  >
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = item.isActive;

            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition duration-150 relative min-h-[44px] ${
                  isActive
                    ? 'text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-brand-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-brand-600 dark:bg-brand-400 mt-0.5" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
