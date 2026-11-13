import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import MobileBottomNav from './MobileBottomNav';
import ScheduleMeetingModal from '../meetings/ScheduleMeetingModal';
import MeetingReminderBanner from '../meetings/MeetingReminderBanner';
import IncomingCallModal from '../notifications/IncomingCallModal';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { roomService } from '../../services/roomService';

const AppLayout = ({ children, onScheduleMeeting }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  // Collapsible sidebar state with local storage persistence and tablet auto-collapse default
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('nexora_sidebar_collapsed') || localStorage.getItem('connectsphere_sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });

  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('nexora_sidebar_collapsed', String(next));
      localStorage.setItem('connectsphere_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Handle auto-collapse on tablet viewports and responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsMobileSidebarOpen(false);
      } else if (window.innerWidth < 1024) {
        const saved = localStorage.getItem('nexora_sidebar_collapsed');
        if (saved === null) {
          setIsSidebarCollapsed(true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Register user presence via socket
  useEffect(() => {
    if (!socket || !user) return;
    socket.emit('register-presence', { user });
  }, [socket, user]);

  // Listen for direct incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (callData) => {
      setIncomingCall(callData);
    };

    socket.on('incoming-call', handleIncomingCall);
    return () => {
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [socket]);

  const handleAcceptCall = (call) => {
    if (socket) {
      socket.emit('call-response', {
        callerId: call.callerId,
        meetingId: call.meetingId,
        accepted: true
      });
    }
    setIncomingCall(null);
    navigate(`/room/${call.meetingId}`);
  };

  const handleDeclineCall = () => {
    if (socket && incomingCall) {
      socket.emit('call-response', {
        callerId: incomingCall.callerId,
        meetingId: incomingCall.meetingId,
        accepted: false
      });
    }
    setIncomingCall(null);
  };

  const handleStartInstant = async () => {
    try {
      const room = await roomService.createRoom(`${user?.name || user?.fullName || 'Quick'}'s Meeting`);
      navigate(`/room/${room.roomId}`);
    } catch {
      const fallbackId = Math.random().toString(36).substring(2, 9);
      navigate(`/room/${fallbackId}`);
    }
  };

  const isDashboardView =
    location.pathname === '/dashboard' || location.pathname === '/messages';

  return (
    <div className="h-screen max-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors overflow-hidden">
      {/* Left Sidebar (Desktop & Tablet) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSchedule={() => setIsScheduleOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-screen max-h-screen transition-all duration-300 w-full min-w-0 overflow-hidden ${
          isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <MeetingReminderBanner />
        <TopHeader
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          onOpenSchedule={() => setIsScheduleOpen(true)}
        />

        {isDashboardView ? (
          <main className="flex-1 w-full min-h-0 overflow-hidden flex flex-col pb-16 md:pb-0">
            {children}
          </main>
        ) : (
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 pb-20 md:pb-8 overflow-y-auto">
            {children}
          </main>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on md and above) */}
      <MobileBottomNav
        onOpenSchedule={() => setIsScheduleOpen(true)}
        onStartInstant={handleStartInstant}
      />

      {/* Global Schedule Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onScheduled={(meeting) => {
          if (onScheduleMeeting) {
            onScheduleMeeting(meeting);
          }
        }}
      />

      {/* Global Incoming Call Alert */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
    </div>
  );
};

export default AppLayout;
