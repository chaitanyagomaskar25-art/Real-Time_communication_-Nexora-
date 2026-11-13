import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserPlus,
  Video,
  Check,
  X,
  Circle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Users,
  MessageSquare,
  Clock,
  Sparkles,
  Copy,
  ExternalLink,
  ShieldCheck,
  Mail,
  User,
  Phone,
  LayoutGrid,
  List
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { ContactSkeleton } from '../components/common/Skeleton';
import StatusDot from '../components/common/StatusDot';
import { useToast } from '../context/ToastContext';
import { contactService } from '../services/contactService';
import { roomService } from '../services/roomService';
import { notificationService } from '../services/notificationService';
import { useSocket } from '../hooks/useSocket';

const Contacts = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'online' | 'recent' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Add contact modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [addError, setAddError] = useState('');

  // Contact profile preview modal
  const [previewContact, setPreviewContact] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Calling state
  const [callingContactId, setCallingContactId] = useState(null);

  // Load contacts and requests from API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [contactsRes, requestsRes] = await Promise.all([
        contactService.getContacts(),
        contactService.getRequests()
      ]);
      setContacts(contactsRes?.data || contactsRes || []);
      setRequests(requestsRes?.data || requestsRes || { incoming: [], outgoing: [] });
    } catch {
      // Safe fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to real-time presence changes
  useEffect(() => {
    if (!socket) return;

    const handlePresenceChanged = ({ userId, isOnline, presenceStatus, lastSeen }) => {
      setContacts((prev) =>
        prev.map((c) => {
          if (c.user && (c.user.id || c.user._id) === userId) {
            return {
              ...c,
              user: {
                ...c.user,
                isOnline,
                presenceStatus: presenceStatus || (isOnline ? 'available' : 'offline'),
                lastSeen: lastSeen || new Date().toISOString()
              }
            };
          }
          return c;
        })
      );
    };

    socket.on('user-presence-changed', handlePresenceChanged);
    return () => {
      socket.off('user-presence-changed', handlePresenceChanged);
    };
  }, [socket]);

  // Search users inside add modal
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await contactService.searchUsers(userSearchQuery);
        const list = res?.data || res || [];
        setUserSearchResults(Array.isArray(list) ? list : []);
      } catch {
        // Safe fallback
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // Send contact request
  const handleSendRequest = async (targetUser) => {
    setAddError('');
    try {
      await contactService.sendRequest(targetUser.id || targetUser._id);
      setSentRequests((prev) => new Set([...prev, targetUser.id || targetUser._id]));
      await loadData();
    } catch (err) {
      setAddError(err?.response?.data?.message || err?.message || 'Failed to send request.');
    }
  };

  // Respond to incoming request
  const handleRespondRequest = async (requestId, status) => {
    try {
      await contactService.respondToRequest(requestId, status);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to process request.');
    }
  };

  // Delete contact
  const handleDeleteContact = async (contactId) => {
    if (window.confirm('Are you sure you want to remove this contact?')) {
      try {
        await contactService.deleteContact(contactId);
        setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
        if (previewContact?.contactId === contactId) {
          setPreviewContact(null);
        }
      } catch (err) {
        alert(err?.response?.data?.message || 'Failed to delete contact.');
      }
    }
  };

  // Launch direct conference call
  const handleStartCall = async (contactUser) => {
    const cid = contactUser.id || contactUser._id;
    setCallingContactId(cid);

    try {
      const room = await roomService.createRoom(
        `Call with ${contactUser.fullName || contactUser.name || 'Contact'}`
      );
      // Notify contact of incoming call
      await notificationService.callUser(cid, room.roomId);
      navigate(`/room/${room.roomId}`);
    } catch {
      const fallbackId = Math.random().toString(36).substring(2, 9);
      navigate(`/room/${fallbackId}`);
    } finally {
      setCallingContactId(null);
    }
  };

  // Start direct conversation action: routes to messages with contact selected
  const handleStartConversation = (contactUser) => {
    const cid = contactUser.id || contactUser._id;
    navigate(`/messages?userId=${cid}`);
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Online contacts list
  const onlineContacts = useMemo(() => {
    return contacts.filter((c) => Boolean(c.user?.isOnline));
  }, [contacts]);

  // Filtered contacts based on search and active tab
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (activeTab === 'online' && !c.user?.isOnline) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.user?.fullName || c.user?.name || '').toLowerCase();
        const email = (c.user?.email || '').toLowerCase();
        const username = (c.user?.username || '').toLowerCase();
        return name.includes(q) || email.includes(q) || username.includes(q);
      }
      return true;
    });
  }, [contacts, activeTab, searchQuery]);

  // Alphabetically organized contacts grouped by initial letter
  const groupedContacts = useMemo(() => {
    const groups = {};
    const sorted = [...filteredContacts].sort((a, b) => {
      const nameA = a.user?.fullName || a.user?.name || '';
      const nameB = b.user?.fullName || b.user?.name || '';
      return nameA.localeCompare(nameB);
    });

    sorted.forEach((c) => {
      const name = c.user?.fullName || c.user?.name || 'Unknown';
      const initial = name.charAt(0).toUpperCase();
      const key = /[A-Z]/.test(initial) ? initial : '#';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(c);
    });

    return groups;
  }, [filteredContacts]);

  const availableLetters = Object.keys(groupedContacts).sort();

  const getStatusBadge = (u) => {
    if (!u?.isOnline) {
      return (
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <StatusDot status="offline" size="xs" />
          <span>Offline</span>
        </span>
      );
    }
    const status = u.presenceStatus || 'available';
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
        <StatusDot status={status} size="xs" />
        <span>
          {status === 'in-meeting'
            ? 'In Meeting'
            : status === 'busy'
            ? 'Busy'
            : status === 'away'
            ? 'Away'
            : 'Available'}
        </span>
      </span>
    );
  };

  const pendingRequestsCount = requests.incoming.length;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto w-full">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              Contacts & Directory
            </h1>
            <Badge variant="primary" size="sm">
              {contacts.length} Linked
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect with team peers, observe live presence, and launch 1-click video calls and messages.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="gradient"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          ONLINE CONTACTS ACTIVE SHELF (WHEN ONLINE CONTACTS EXIST)
          ========================================================================= */}
      {onlineContacts.length > 0 && activeTab !== 'requests' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Online Contacts ({onlineContacts.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Available for instant calls</span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
            {onlineContacts.map((c) => {
              const u = c.user;
              return (
                <div
                  key={c.contactId}
                  onClick={() => setPreviewContact(c)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-dark-850 cursor-pointer transition shrink-0 group w-20 text-center"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {(u.fullName || u.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 shadow-sm" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate w-full group-hover:text-brand-600 dark:group-hover:text-brand-400">
                    {u.fullName?.split(' ')[0] || u.name?.split(' ')[0] || 'User'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTROLS: TABS, SEARCH, AND VIEW TOGGLE
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-900 p-3 rounded-2xl border border-slate-200/90 dark:border-dark-750 shadow-card">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle border border-brand-200/60 dark:border-brand-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-dark-850'
            }`}
          >
            <span>All Contacts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-dark-800 font-bold">
              {contacts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('online')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'online'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-subtle border border-emerald-200 dark:border-emerald-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-dark-850'
            }`}
          >
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
            <span>Online</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-dark-800 font-bold">
              {onlineContacts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle border border-brand-200/60 dark:border-brand-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-dark-850'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Field & View Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-200/90 dark:border-dark-750 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-subtle transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid vs List View Selector */}
          <div className="hidden sm:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-dark-850 border border-slate-200/60 dark:border-dark-750">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN TAB CONTENT: DIRECTORY OR REQUESTS
          ========================================================================= */}
      {activeTab === 'requests' ? (
        /* Requests Management View */
        <div className="space-y-6">
          {/* Incoming Connection Requests */}
          <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 p-6 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Incoming Requests</span>
              <Badge variant="primary" size="sm">
                {requests.incoming.length}
              </Badge>
            </h3>

            {requests.incoming.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No pending incoming requests. Your inbox is up to date!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requests.incoming.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-750 flex items-center justify-between gap-3 bg-slate-50 dark:bg-dark-850"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                        {(req.user?.fullName || req.user?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                          {req.user?.fullName || req.user?.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                          @{req.user?.username || req.user?.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRespondRequest(req.requestId, 'accepted')}
                        className="text-xs py-1 px-3 !bg-emerald-600 hover:!bg-emerald-500 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRespondRequest(req.requestId, 'rejected')}
                        className="text-xs py-1 px-2.5 hover:text-rose-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 p-6 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Outgoing Requests</span>
              <Badge variant="default" size="sm">
                {requests.outgoing.length}
              </Badge>
            </h3>

            {requests.outgoing.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No outgoing requests pending.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requests.outgoing.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-750 flex items-center justify-between gap-3 bg-slate-50 dark:bg-dark-850"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-2xl bg-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(req.user?.fullName || req.user?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                          {req.user?.fullName || req.user?.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                          @{req.user?.username || req.user?.email}
                        </span>
                      </div>
                    </div>

                    <Badge variant="warning" size="sm">
                      Pending Approval
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* =========================================================================
           ALPHABETICAL DIRECTORY VIEW (GRID & LIST)
           ========================================================================= */
        <div>
          {isLoading ? (
            /* Premium Shimmer Skeletons */
            <ContactSkeleton count={6} />
          ) : filteredContacts.length === 0 ? (
            /* Custom NEXORA Empty State */
            <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 p-6 sm:p-10 shadow-card">
              <EmptyState
                illustration={searchQuery ? 'search' : 'contacts'}
                title={
                  searchQuery
                    ? 'No matching contacts found'
                    : activeTab === 'online'
                    ? 'No contacts currently online'
                    : 'No contacts linked yet'
                }
                description={
                  searchQuery
                    ? `No contacts matched "${searchQuery}". Try another name, email, or username.`
                    : 'Connect with teammates to send direct messages, see live presence, and launch instant video conferences.'
                }
                action={
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-1 shadow-sm font-semibold"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    <span>Add Your First Contact</span>
                  </Button>
                }
              />
            </div>
          ) : (
            /* Alphabetical Grouping Sections */
            <div className="space-y-8">
              {availableLetters.map((letter) => (
                <div key={letter} className="space-y-3">
                  {/* Section Divider Badge */}
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800/60 text-brand-700 dark:text-brand-300 font-extrabold text-xs flex items-center justify-center shadow-subtle">
                      {letter}
                    </span>
                    <div className="h-px flex-1 bg-slate-200/70 dark:border-dark-750" />
                  </div>

                  {/* Cards Grid / List */}
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                        : 'space-y-2.5'
                    }
                  >
                    {groupedContacts[letter].map((c) => {
                      const u = c.user;
                      const isCalling = callingContactId === (u.id || u._id);

                      return (
                        <div
                          key={c.contactId}
                          className={`p-4 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card hover:border-brand-400/50 dark:hover:border-brand-500/40 hover:shadow-elevated transition-all duration-200 flex ${
                            viewMode === 'grid'
                              ? 'flex-col justify-between'
                              : 'flex-col sm:flex-row sm:items-center justify-between gap-3'
                          }`}
                        >
                          {/* Profile Presentation */}
                          <div
                            onClick={() => setPreviewContact(c)}
                            className="cursor-pointer group select-none"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3.5 truncate">
                                {/* Avatar with Live Presence Indicator */}
                                <div className="relative shrink-0">
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform duration-200">
                                    {(u.fullName || u.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <span
                                    className={`w-3.5 h-3.5 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 transition-colors ${
                                      u.isOnline
                                        ? u.presenceStatus === 'busy' || u.presenceStatus === 'in-meeting'
                                          ? 'bg-rose-500'
                                          : u.presenceStatus === 'away'
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                        : 'bg-slate-400'
                                    }`}
                                  />
                                </div>

                                <div className="truncate min-w-0">
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors font-heading">
                                    {u.fullName || u.name}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    @{u.username || u.email?.split('@')[0]}
                                  </p>
                                </div>
                              </div>

                              {getStatusBadge(u)}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 truncate flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.email}</span>
                            </p>
                          </div>

                          {/* Quick Action Buttons: Message, Call, Delete */}
                          <div
                            className={`pt-3 mt-4 border-t border-slate-100 dark:border-dark-750 flex items-center justify-between gap-2 ${
                              viewMode === 'list' ? 'sm:border-t-0 sm:pt-0 sm:mt-0' : ''
                            }`}
                          >
                            <button
                              onClick={() => handleDeleteContact(c.contactId)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Remove Contact"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-center gap-2">
                              {/* Direct Message Action */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleStartConversation(u)}
                                className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                                title="Open Direct Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                                <span>Message</span>
                              </Button>

                              {/* Video Call Action */}
                              <Button
                                variant="gradient"
                                size="sm"
                                onClick={() => handleStartCall(u)}
                                disabled={isCalling}
                                className="text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                                title="Start Video Call"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>{isCalling ? 'Calling...' : 'Call'}</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ATTRACTIVE PROFILE PREVIEW MODAL
          ========================================================================= */}
      {previewContact && (
        <Modal
          isOpen={Boolean(previewContact)}
          onClose={() => setPreviewContact(null)}
          title="Contact Profile"
          maxWidth="max-w-md"
        >
          <div className="space-y-6 pt-2">
            {/* Header Banner & Avatar */}
            <div className="relative flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-elevated mb-3 relative">
                {(previewContact.user?.fullName || previewContact.user?.name || 'U').charAt(0).toUpperCase()}
                <span
                  className={`w-4 h-4 rounded-full absolute -bottom-1 -right-1 ring-3 ring-white dark:ring-dark-900 ${
                    previewContact.user?.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                {previewContact.user?.fullName || previewContact.user?.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{previewContact.user?.username || 'user'}
              </p>

              <div className="mt-2">{getStatusBadge(previewContact.user)}</div>
            </div>

            {/* Information Grid */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Email Address</span>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <span>{previewContact.user?.email}</span>
                  <button
                    onClick={() => handleCopyEmail(previewContact.user?.email)}
                    className="p-1 text-slate-400 hover:text-brand-500"
                    title="Copy Email"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Workspace Status</span>
                <Badge variant="violet" size="sm">
                  Active Member
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Signaling Security</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  E2EE P2P Verified
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  const u = previewContact.user;
                  setPreviewContact(null);
                  handleStartConversation(u);
                }}
                className="justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Message</span>
              </Button>

              <Button
                variant="gradient"
                size="md"
                onClick={() => {
                  const u = previewContact.user;
                  setPreviewContact(null);
                  handleStartCall(u);
                }}
                className="justify-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          ADD CONTACT MODAL
          ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setUserSearchQuery('');
          setUserSearchResults([]);
          setAddError('');
        }}
        title="Find & Connect Teammates"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Search registered NEXORA users by name, @username, or email address to link up for encrypted calls and direct messages.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by full name, @handle, or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-200/90 dark:border-dark-750 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          {/* Search Results Stream */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {isSearchingUsers ? (
              <div className="text-center py-6 text-slate-400">
                <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-brand-500" />
                <span>Searching NEXORA directory...</span>
              </div>
            ) : userSearchResults.length === 0 && userSearchQuery.trim() ? (
              <div className="text-center py-6 text-slate-400">
                No users found matching &ldquo;{userSearchQuery}&rdquo;
              </div>
            ) : (
              userSearchResults.map((targetUser) => {
                const targetId = targetUser.id || targetUser._id;
                const isAlreadyContact = contacts.some((c) => (c.user?.id || c.user?._id) === targetId);
                const isSent = sentRequests.has(targetId);

                return (
                  <div
                    key={targetId}
                    className="p-3 rounded-2xl border border-slate-200/80 dark:border-dark-750 flex items-center justify-between gap-3 bg-white dark:bg-dark-900 shadow-subtle"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                        {(targetUser.fullName || targetUser.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {targetUser.fullName || targetUser.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          @{targetUser.username} · {targetUser.email}
                        </span>
                      </div>
                    </div>

                    {isAlreadyContact ? (
                      <Badge variant="success" size="sm">
                        Connected
                      </Badge>
                    ) : isSent ? (
                      <Badge variant="warning" size="sm">
                        Request Sent
                      </Badge>
                    ) : (
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={() => handleSendRequest(targetUser)}
                        className="text-xs py-1 px-3"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        <span>Connect</span>
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Contacts;
