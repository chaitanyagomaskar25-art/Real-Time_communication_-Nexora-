import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Video,
  Plus,
  ArrowRight,
  Clock,
  Users,
  Copy,
  Check,
  Calendar,
  Sparkles,
  PhoneCall,
  Activity,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Lock,
  Trash2,
  ExternalLink,
  Zap,
  MessageSquare
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { meetingService } from '../services/meetingService';
import { contactService } from '../services/contactService';
import { messageService } from '../services/messageService';
import CreateMeetingModal from '../components/room/CreateMeetingModal';
import JoinMeetingModal from '../components/room/JoinMeetingModal';
import ConversationPanel from '../components/chat/ConversationPanel';
import NewConversationModal from '../components/chat/NewConversationModal';
import RealtimeChatInterface from '../components/chat/RealtimeChatInterface';
import ConfirmDialog from '../components/common/ConfirmDialog';
import NexoraConstellationHero from '../components/dashboard/NexoraConstellationHero';

const Dashboard = ({ defaultView = 'dashboard' }) => {
  const { user } = useAuth();
  const { isConnected, socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const isMessagesView =
    defaultView === 'messages' ||
    location.pathname === '/messages' ||
    location.search.includes('view=messages');

  // Instant / Join states
  const [joinCode, setJoinCode] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isInstantStarting, setIsInstantStarting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialTab, setCreateInitialTab] = useState('instant');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Dynamic meetings state
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [meetingToCancel, setMeetingToCancel] = useState(null);

  // Conversations & Middle Panel state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);

  // Track initial tab from URL query params (e.g. ?tab=groups or ?tab=favorites)
  const [activeConvTab, setActiveConvTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'all';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['all', 'unread', 'groups', 'favorites'].includes(tab)) {
      setActiveConvTab(tab);
    }
  }, [location.search]);

  // Active chat state
  const [conversationMessages, setConversationMessages] = useState({});
  const [conversationPagination, setConversationPagination] = useState({});
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);

  // Fetch upcoming and recent meetings
  const fetchMeetings = useCallback(async () => {
    try {
      const [upcomingData, historyData] = await Promise.allSettled([
        meetingService.getUpcomingMeetings(),
        meetingService.getMeetingHistory()
      ]);

      if (upcomingData.status === 'fulfilled' && Array.isArray(upcomingData.value)) {
        setUpcomingMeetings(
          upcomingData.value.map((m) => ({
            id: m.id || m._id || m.meetingId,
            meetingId: m.meetingId,
            roomId: m.meetingId,
            title: m.title,
            date: m.scheduledDate
              ? new Date(m.scheduledDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })
              : 'Upcoming',
            time: m.scheduledTime || '10:00 AM',
            duration: `${m.duration || 30} mins`,
            participantsCount: m.participantCount || (m.participants ? m.participants.length : 1),
            isHost: m.isHost ?? (user && m.host && m.host.toString() === (user._id || user.id)?.toString()),
            isPasswordProtected: m.isPasswordProtected
          }))
        );
      } else {
        setUpcomingMeetings([]);
      }

      if (historyData.status === 'fulfilled' && Array.isArray(historyData.value)) {
        // Filter out instant/ad-hoc calls from chat; only display scheduled meetings
        const scheduledOnly = historyData.value.filter((m) => {
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

        setRecentMeetings(
          scheduledOnly.slice(0, 5).map((m) => ({
            id: m.id || m._id || m.meetingId,
            meetingId: m.meetingId,
            roomId: m.meetingId,
            title: m.title,
            date: m.scheduledDate || m.createdAt
              ? new Date(m.scheduledDate || m.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })
              : 'Scheduled',
            duration: `${m.duration || 30} mins`,
            participants: m.participants ? m.participants.length : 1
          }))
        );
      } else {
        setRecentMeetings([]);
      }
    } catch {
      setUpcomingMeetings([]);
      setRecentMeetings([]);
    }
  }, [user]);

  // Load contacts and build initial conversation list
  const loadConversations = useCallback(async () => {
    setIsConversationsLoading(true);
    try {
      const contactsRes = await contactService.getContacts().catch(() => []);
      const contactList = contactsRes?.data || contactsRes || [];

      const builtConversations = [];

      // Add contacts as direct messages
      if (Array.isArray(contactList)) {
        contactList.forEach((c) => {
          const contactUser = c.user || c;
          const uid = contactUser.id || contactUser._id;
          const name = contactUser.fullName || contactUser.name || 'Team Colleague';
          builtConversations.push({
            id: `dm-${uid}`,
            targetUserId: uid,
            name,
            email: contactUser.email,
            isGroup: false,
            isOnline: Boolean(contactUser.isOnline),
            status: contactUser.presenceStatus || (contactUser.isOnline ? 'online' : 'offline'),
            avatarText: name.charAt(0).toUpperCase(),
            lastMessage: 'Ready for real-time collaboration',
            timestamp: 'Just now',
            unreadCount: 0,
            lastSeen: contactUser.lastSeen || new Date().toISOString()
          });
        });
      }

      // Load deleted groups to prevent them from re-appearing
      let deletedGroups = [];
      try {
        deletedGroups = JSON.parse(localStorage.getItem('nexora_deleted_groups') || '[]');
        if (!Array.isArray(deletedGroups)) deletedGroups = [];
      } catch {}

      // Load cleared conversations so cleared chat history stays empty across page refreshes
      let clearedConversations = [];
      try {
        clearedConversations = JSON.parse(localStorage.getItem('nexora_cleared_conversations') || '[]');
        if (!Array.isArray(clearedConversations)) clearedConversations = [];
      } catch {}

      // Load custom groups saved in localStorage
      let customGroups = [];
      try {
        const saved = JSON.parse(localStorage.getItem('nexora_custom_groups') || '[]');
        if (Array.isArray(saved)) {
          customGroups = saved
            .filter((g) => !deletedGroups.includes(g.id))
            .map((g) => ({
              ...g,
              lastMessage: clearedConversations.includes(g.id) ? '' : (g.lastMessage || ''),
              timestamp: clearedConversations.includes(g.id) ? '' : (g.timestamp || '')
            }));
        }
      } catch {}

      const defaultGroups = [
        {
          id: 'group-general',
          name: 'General Workspace',
          isGroup: true,
          lastMessage: clearedConversations.includes('group-general') ? '' : 'Signaling server connected & ready for conference calls',
          timestamp: clearedConversations.includes('group-general') ? '' : '10:00 AM',
          unreadCount: 0
        },
        {
          id: 'group-engineering',
          name: 'Architecture & WebRTC Sync',
          isGroup: true,
          lastMessage: clearedConversations.includes('group-engineering') ? '' : 'P2P mesh video bitrate verified at 1080p 60fps',
          timestamp: clearedConversations.includes('group-engineering') ? '' : 'Yesterday',
          unreadCount: 0
        }
      ].filter((g) => !deletedGroups.includes(g.id));

      // Add custom groups and default group channels
      builtConversations.unshift(...customGroups, ...defaultGroups);

      setConversations(builtConversations);
    } catch {
      let deletedGroups = [];
      try {
        deletedGroups = JSON.parse(localStorage.getItem('nexora_deleted_groups') || '[]');
        if (!Array.isArray(deletedGroups)) deletedGroups = [];
      } catch {}

      let clearedConversations = [];
      try {
        clearedConversations = JSON.parse(localStorage.getItem('nexora_cleared_conversations') || '[]');
        if (!Array.isArray(clearedConversations)) clearedConversations = [];
      } catch {}

      let customGroups = [];
      try {
        const saved = JSON.parse(localStorage.getItem('nexora_custom_groups') || '[]');
        if (Array.isArray(saved)) {
          customGroups = saved
            .filter((g) => !deletedGroups.includes(g.id))
            .map((g) => ({
              ...g,
              lastMessage: clearedConversations.includes(g.id) ? '' : (g.lastMessage || ''),
              timestamp: clearedConversations.includes(g.id) ? '' : (g.timestamp || '')
            }));
        }
      } catch {}

      const defaultGroups = [
        {
          id: 'group-general',
          name: 'General Workspace',
          isGroup: true,
          lastMessage: clearedConversations.includes('group-general') ? '' : 'Signaling server connected & ready for conference calls',
          timestamp: clearedConversations.includes('group-general') ? '' : '10:00 AM',
          unreadCount: 0
        },
        {
          id: 'group-engineering',
          name: 'Architecture & WebRTC Sync',
          isGroup: true,
          lastMessage: clearedConversations.includes('group-engineering') ? '' : 'P2P mesh video bitrate verified at 1080p 60fps',
          timestamp: clearedConversations.includes('group-engineering') ? '' : 'Yesterday',
          unreadCount: 0
        }
      ].filter((g) => !deletedGroups.includes(g.id));

      setConversations([...customGroups, ...defaultGroups]);
    } finally {
      setIsConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    loadConversations();
  }, [fetchMeetings, loadConversations]);

  // Track if initial conversation from URL has been selected
  const initialConvLoadedRef = useRef(false);

  // Auto-select conversation on initial load or when specific query param is passed
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setIsNewConversationOpen(true);
    }

    const requestedConvId = params.get('convId');
    const requestedUserId = params.get('userId');

    if (conversations.length > 0 && !initialConvLoadedRef.current) {
      if (requestedConvId || requestedUserId) {
        const match = conversations.find(
          (c) =>
            (requestedConvId &&
              (c.id === requestedConvId ||
                c.roomId === requestedConvId ||
                c.targetUserId === requestedConvId ||
                c.id === `dm-${requestedConvId}`)) ||
            (requestedUserId &&
              (c.targetUserId === requestedUserId ||
                c.id === `dm-${requestedUserId}` ||
                c.id === requestedUserId))
        );
        if (match) {
          setSelectedConversation(match);
          initialConvLoadedRef.current = true;
          return;
        }
      }

      if (isMessagesView && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedConversation(conversations[0]);
        initialConvLoadedRef.current = true;
      }
    }
  }, [isMessagesView, conversations]);

  // Normalize reactions per-user so current user only adds at most 1 count to any emoji
  const normalizeReactions = useCallback((rawReactions, currentUserId) => {
    if (!Array.isArray(rawReactions)) return [];
    return rawReactions
      .map((r) => {
        const users = Array.isArray(r.users) ? r.users : [];
        const hasReacted = Boolean(
          r.hasReacted ||
            users.some((u) => {
              const uId = typeof u === 'string' ? u : u.userId || u.id || u._id;
              return uId && currentUserId && String(uId) === String(currentUserId);
            })
        );
        const count = typeof r.count === 'number' ? r.count : users.length;
        return {
          emoji: r.emoji,
          count: Math.max(count, users.length, 1),
          users,
          hasReacted
        };
      })
      .filter((r) => r.count > 0);
  }, []);

  // Format message object for RealtimeChatInterface
  const formatIncomingMessage = useCallback((m) => {
    const currentUserId = user?.id || user?._id;
    const isSystem = Boolean(
      m.messageType === 'system' ||
      m.isSystem ||
      m.senderId === 'system' ||
      m.sender === 'System' ||
      m.senderName === 'System' ||
      (typeof m.content === 'string' && (
        m.content.startsWith('📞') ||
        m.content.includes('Started a voice call') ||
        m.content.includes('Started a video call') ||
        m.content.startsWith('User joined') ||
        m.content.startsWith('User left')
      ))
    );

    const isMe = !isSystem && Boolean(
      (currentUserId && m.senderId && String(m.senderId) === String(currentUserId)) ||
      (m.senderName && (m.senderName === user?.name || m.senderName === user?.fullName)) ||
      m.isMe
    );

    return {
      id: m.id || m._id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      _id: m._id || m.id,
      sender: isSystem ? 'System' : (isMe ? 'You' : (m.senderName || m.sender || 'Peer')),
      senderName: isSystem ? 'System' : (m.senderName || m.sender || (isMe ? 'You' : 'Peer')),
      senderId: m.senderId,
      isMe,
      isSystem,
      messageType: isSystem ? 'system' : (m.messageType || 'user'),
      isCallEnded: Boolean(m.isCallEnded),
      content: m.content || '',
      file: m.file || null,
      replyTo: m.replyTo || null,
      isEdited: Boolean(m.isEdited),
      reactions: normalizeReactions(m.reactions, currentUserId),
      status: m.status || 'delivered',
      timestamp: new Date(m.timestamp || m.createdAt || Date.now()).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: m.timestamp || m.createdAt || new Date().toISOString()
    };
  }, [user, normalizeReactions]);

  // Load messages from MongoDB in small parts (20 items per batch)
  const loadConversationMessages = useCallback(async (convId, isInitial = false) => {
    if (!convId) return;

    if (isInitial && (!conversationMessages[convId] || conversationMessages[convId].length === 0)) {
      setIsMessagesLoading(true);
    }

    try {
      const response = await messageService.getMessages(convId, { limit: 20 });
      const data = response?.data || response || {};
      const rawList = Array.isArray(data.messages) ? data.messages : (Array.isArray(data) ? data : []);
      const formatted = rawList.map(formatIncomingMessage);

      setConversationMessages((prev) => ({
        ...prev,
        [convId]: formatted
      }));

      if (rawList.length === 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, lastMessage: '', timestamp: '' }
              : c
          )
        );
      }

      setConversationPagination((prev) => ({
        ...prev,
        [convId]: {
          hasMore: Boolean(data.hasMore),
          page: data.page || 1,
          total: data.total || formatted.length,
          oldestTimestamp: formatted.length > 0 ? formatted[0].createdAt : null
        }
      }));
    } catch (err) {
      console.warn(`Failed to fetch messages for ${convId}:`, err);
    } finally {
      setIsMessagesLoading(false);
    }
  }, [conversationMessages, formatIncomingMessage]);

  // Infinite scroll up: reload earlier message history from MongoDB
  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;
    const currentPag = conversationPagination[convId];

    if (!currentPag || !currentPag.hasMore || isLoadingOlder[convId]) {
      return;
    }

    setIsLoadingOlder((prev) => ({ ...prev, [convId]: true }));
    try {
      const response = await messageService.getMessages(convId, {
        limit: 20,
        before: currentPag.oldestTimestamp
      });
      const data = response?.data || response || {};
      const rawList = Array.isArray(data.messages) ? data.messages : [];
      const olderFormatted = rawList.map(formatIncomingMessage);

      if (olderFormatted.length > 0) {
        setConversationMessages((prev) => {
          const existing = prev[convId] || [];
          const existingIds = new Set(existing.map((m) => m.id || m._id));
          const uniqueOlder = olderFormatted.filter((m) => !existingIds.has(m.id || m._id));
          return {
            ...prev,
            [convId]: [...uniqueOlder, ...existing]
          };
        });

        setConversationPagination((prev) => ({
          ...prev,
          [convId]: {
            hasMore: Boolean(data.hasMore),
            page: (prev[convId]?.page || 1) + 1,
            total: data.total || (prev[convId]?.total || 0),
            oldestTimestamp: olderFormatted[0]?.createdAt || prev[convId]?.oldestTimestamp
          }
        }));
      } else {
        setConversationPagination((prev) => ({
          ...prev,
          [convId]: {
            ...(prev[convId] || {}),
            hasMore: false
          }
        }));
      }
    } catch (err) {
      console.warn(`Failed to load earlier messages for ${convId}:`, err);
    } finally {
      setIsLoadingOlder((prev) => ({ ...prev, [convId]: false }));
    }
  }, [selectedConversation, conversationPagination, isLoadingOlder, formatIncomingMessage]);

  // Join conversation room and load messages from MongoDB on conversation switch
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const convId = selectedConversation.id;

    if (socket && isConnected) {
      socket.emit('join-conversation', { conversationId: convId, roomId: convId });
    }

    if (!conversationMessages[convId] || conversationMessages[convId].length === 0) {
      loadConversationMessages(convId, true);
    }

    return () => {
      if (socket && isConnected) {
        socket.emit('leave-conversation', { conversationId: convId, roomId: convId });
      }
    };
  }, [selectedConversation?.id, socket, isConnected]);

  // Socket.IO Listeners for live messaging and typing
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const convId = msg.roomId || msg.conversationId;
      if (!convId) return;

      const formattedMsg = formatIncomingMessage(msg);

      setConversationMessages((prev) => {
        const existing = prev[convId] || [];

        // 1. If message already exists by ID, do not duplicate
        if (
          existing.some(
            (m) =>
              (m.id && (m.id === formattedMsg.id || m.id === formattedMsg._id)) ||
              (m._id && (m._id === formattedMsg._id || m._id === formattedMsg.id))
          )
        ) {
          return prev;
        }

        // 2. Check if this confirms an optimistic message matching clientTempId
        const matchTempId = msg.clientTempId || formattedMsg.clientTempId;
        if (matchTempId) {
          const tempIdx = existing.findIndex(
            (m) => m.id === matchTempId || m.clientTempId === matchTempId
          );
          if (tempIdx !== -1) {
            const updated = [...existing];
            updated[tempIdx] = {
              ...formattedMsg,
              clientTempId: matchTempId
            };
            return {
              ...prev,
              [convId]: updated
            };
          }
        }

        // 3. Fallback: match pending sending message with identical sender and content
        if (formattedMsg.isMe) {
          const pendingIdx = existing.findIndex(
            (m) => m.status === 'sending' && m.content === formattedMsg.content
          );
          if (pendingIdx !== -1) {
            const updated = [...existing];
            updated[pendingIdx] = formattedMsg;
            return {
              ...prev,
              [convId]: updated
            };
          }
        }

        return {
          ...prev,
          [convId]: [...existing, formattedMsg]
        };
      });

      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: `${formattedMsg.sender}: ${formattedMsg.content}`,
                timestamp: 'Just now',
                unreadCount: selectedConversation?.id === convId ? 0 : (c.unreadCount || 0) + 1
              }
            : c
        )
      );
    };

    const handleMessageEdited = ({ messageId, newContent }) => {
      setConversationMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = (updated[key] || []).map((m) =>
            (m.id === messageId || m._id === messageId)
              ? { ...m, content: newContent, isEdited: true }
              : m
          );
        });
        return updated;
      });
    };

    const handleMessageDeleted = ({ messageId, alternateId }) => {
      setConversationMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = (updated[key] || []).filter(
            (m) =>
              m.id !== messageId &&
              m._id !== messageId &&
              (!alternateId || (m.id !== alternateId && m._id !== alternateId))
          );
        });
        return updated;
      });
    };

    const handleUserTyping = ({ userId, userName, isTyping }) => {
      if (userId === (user?.id || user?._id)) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [...prev, { userId, userName }];
        } else {
          return prev.filter((u) => u.userId !== userId);
        }
      });
    };

    const handlePresenceChange = ({ userId, isOnline, status, lastSeen }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.targetUserId === userId || c.id === `dm-${userId}`
            ? {
                ...c,
                isOnline: Boolean(isOnline),
                status: status || (isOnline ? 'available' : 'offline'),
                lastSeen: lastSeen || new Date().toISOString()
              }
            : c
        )
      );

      setSelectedConversation((prev) => {
        if (prev && (prev.targetUserId === userId || prev.id === `dm-${userId}`)) {
          return {
            ...prev,
            isOnline: Boolean(isOnline),
            status: status || (isOnline ? 'available' : 'offline'),
            lastSeen: lastSeen || new Date().toISOString()
          };
        }
        return prev;
      });
    };

    const handleReactionUpdated = ({ messageId, reactions, roomId }) => {
      const currentUserId = user?.id || user?._id;
      setConversationMessages((prev) => {
        const targetRooms = roomId ? [roomId] : Object.keys(prev);
        const updated = { ...prev };
        targetRooms.forEach((rId) => {
          if (updated[rId]) {
            updated[rId] = updated[rId].map((m) => {
              if (m.id === messageId || m._id === messageId) {
                return {
                  ...m,
                  reactions: normalizeReactions(reactions, currentUserId)
                };
              }
              return m;
            });
          }
        });
        return updated;
      });
    };

    const handleCallSessionEnded = ({ roomId }) => {
      if (!roomId) return;
      sessionStorage.setItem(`ended_call_${roomId}`, 'true');
      localStorage.setItem(`ended_call_${roomId}`, 'true');

      setConversationMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = (updated[key] || []).map((m) => {
            if (m.content && m.content.includes(`/room/${roomId}`)) {
              return { ...m, isCallEnded: true };
            }
            return m;
          });
        });
        return updated;
      });
    };

    const handleChatCleared = ({ roomId }) => {
      if (!roomId) return;
      const cleanRoom = roomId.toLowerCase().trim();

      // Track in cleared conversations
      let clearedConversations = [];
      try {
        clearedConversations = JSON.parse(localStorage.getItem('nexora_cleared_conversations') || '[]');
        if (!Array.isArray(clearedConversations)) clearedConversations = [];
      } catch {}
      if (!clearedConversations.includes(cleanRoom)) {
        clearedConversations.push(cleanRoom);
        localStorage.setItem('nexora_cleared_conversations', JSON.stringify(clearedConversations));
      }

      setConversationMessages((prev) => ({
        ...prev,
        [cleanRoom]: []
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === cleanRoom
            ? { ...c, lastMessage: '', timestamp: '' }
            : c
        )
      );
    };

    const handleMessagePinned = ({ roomId, messageId, alternateId, isPinned }) => {
      setConversationMessages((prev) => {
        const cleanRoom = roomId ? roomId.toLowerCase().trim() : null;
        const targetRooms = cleanRoom ? [cleanRoom] : Object.keys(prev);
        const updated = { ...prev };
        targetRooms.forEach((rId) => {
          if (updated[rId]) {
            updated[rId] = updated[rId].map((m) => {
              if (
                m.id === messageId ||
                m._id === messageId ||
                (alternateId && (m.id === alternateId || m._id === alternateId))
              ) {
                return { ...m, isPinned: Boolean(isPinned) };
              }
              return m;
            });
          }
        });
        return updated;
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('reaction-updated', handleReactionUpdated);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-presence-changed', handlePresenceChange);
    socket.on('call-session-ended', handleCallSessionEnded);
    socket.on('chat-cleared', handleChatCleared);
    socket.on('message-pinned', handleMessagePinned);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('reaction-updated', handleReactionUpdated);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-presence-changed', handlePresenceChange);
      socket.off('call-session-ended', handleCallSessionEnded);
      socket.off('chat-cleared', handleChatCleared);
      socket.off('message-pinned', handleMessagePinned);
    };
  }, [socket, user, selectedConversation, formatIncomingMessage, normalizeReactions]);

  const handleStartInstant = async (e) => {
    e?.preventDefault();
    setIsInstantStarting(true);
    try {
      const res = await meetingService.createInstantMeeting({
        title: meetingTitle.trim() || `${user?.name || 'Instant'}'s Meeting`,
        settings: { waitingRoomEnabled: false }
      });
      navigate(`/room/${res.meetingId}`);
    } catch {
      const cleanId =
        Math.random().toString(36).substring(2, 6) +
        '-' +
        Math.random().toString(36).substring(2, 6) +
        '-' +
        Math.random().toString(36).substring(2, 6);
      navigate(`/room/${cleanId}`);
    } finally {
      setIsInstantStarting(false);
    }
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    const trimmed = joinCode.trim();
    if (!trimmed) return;
    if (trimmed.includes('/room/')) {
      const clean = trimmed.split('/room/')[1].split('?')[0];
      navigate(`/room/${clean}`);
    } else {
      navigate(`/room/${trimmed}`);
    }
  };

  const handleCopyCode = (roomId) => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancelMeeting = (meetingId) => {
    setMeetingToCancel(meetingId);
  };

  const handleMeetingCreated = (meeting) => {
    if (meeting.status === 'scheduled') {
      fetchMeetings();
    }
  };

  const openScheduleModal = () => {
    setCreateInitialTab('schedule');
    setIsCreateOpen(true);
  };

  const openInstantModal = () => {
    setCreateInitialTab('instant');
    setIsCreateOpen(true);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Select a conversation and update URL query params
  const handleSelectConversation = (conv) => {
    if (!conv) return;
    initialConvLoadedRef.current = true;
    setSelectedConversation(conv);
    const params = new URLSearchParams(location.search);
    params.set('convId', conv.id);
    navigate({ search: params.toString() }, { replace: true });
  };

  // Start direct conversation from modal
  const handleStartDirectConversation = (targetUser) => {
    const uid = targetUser.id || targetUser._id;
    const name = targetUser.fullName || targetUser.name || 'User';
    const existing = conversations.find((c) => c.targetUserId === uid || c.id === `dm-${uid}` || c.id === uid);

    if (existing) {
      handleSelectConversation(existing);
    } else {
      const newConv = {
        id: `dm-${uid}`,
        targetUserId: uid,
        name,
        email: targetUser.email,
        isGroup: false,
        isOnline: Boolean(targetUser.isOnline),
        status: targetUser.presenceStatus || 'available',
        avatarText: name.charAt(0).toUpperCase(),
        lastMessage: 'Conversation started',
        timestamp: 'Just now',
        unreadCount: 0,
        lastSeen: targetUser.lastSeen || new Date().toISOString()
      };
      setConversations((prev) => [newConv, ...prev]);
      handleSelectConversation(newConv);
    }
  };

  // Create new group room from modal
  const handleCreateGroupRoom = (title) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'group';
    const groupId = `group-${slug}-${Date.now().toString(36)}`;
    const newGroup = {
      id: groupId,
      name: title,
      isGroup: true,
      lastMessage: 'Group channel created',
      timestamp: 'Just now',
      unreadCount: 0
    };

    try {
      const existingSaved = JSON.parse(localStorage.getItem('nexora_custom_groups') || '[]');
      const updatedSaved = [newGroup, ...existingSaved.filter((g) => g.id !== newGroup.id)];
      localStorage.setItem('nexora_custom_groups', JSON.stringify(updatedSaved));
    } catch {}

    setConversations((prev) => [newGroup, ...prev]);
    handleSelectConversation(newGroup);
  };

  // Send message in active conversation (stores in MongoDB and broadcasts via Socket.IO)
  const handleSendMessage = async ({ content, file, replyTo, messageType }) => {
    if (!selectedConversation) return;

    const convId = selectedConversation.id;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const currentUserId = user?.id || user?._id;

    const isSystemMsg = Boolean(
      messageType === 'system' ||
      (typeof content === 'string' && (
        content.startsWith('📞') ||
        content.includes('Started a voice call') ||
        content.includes('Started a video call') ||
        content.startsWith('User joined') ||
        content.startsWith('User left')
      ))
    );

    // Create immediate local object URL for instant sender preview
    let localPreviewUrl = null;
    if (file && typeof window !== 'undefined' && (file instanceof Blob || file.type?.startsWith('image/'))) {
      try {
        localPreviewUrl = URL.createObjectURL(file);
      } catch {
        localPreviewUrl = null;
      }
    }

    const optimisticMsg = {
      id: tempId,
      _id: tempId,
      sender: isSystemMsg ? 'System' : (user?.name || user?.fullName || 'You'),
      senderName: isSystemMsg ? 'System' : (user?.name || user?.fullName || 'You'),
      senderId: isSystemMsg ? 'system' : currentUserId,
      isMe: !isSystemMsg,
      isSystem: isSystemMsg,
      messageType: isSystemMsg ? 'system' : 'user',
      content: content || '',
      file: file
        ? {
            name: file.name,
            size: file.size,
            type: file.type,
            url: localPreviewUrl || file.url || null
          }
        : null,
      replyTo,
      status: 'sending',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString()
    };

    setConversationMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), optimisticMsg]
    }));

    // Update last message in conversation list
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMessage: file
                ? (content ? content : `📎 ${file.name || 'Attachment'}`)
                : (isSystemMsg ? content : `You: ${content}`),
              timestamp: 'Just now',
              unreadCount: 0
            }
          : c
      )
    );

    // 1. Upload to Cloudinary (if file attached) and persist to MongoDB
    try {
      let uploadedFileData = null;
      if (file && file instanceof Blob) {
        try {
          const uploadRes = await messageService.uploadAttachment(file, convId);
          if (uploadRes && uploadRes.url) {
            uploadedFileData = {
              name: uploadRes.name || file.name,
              size: uploadRes.size || file.size,
              type: uploadRes.type || file.type,
              url: uploadRes.url,
              publicId: uploadRes.publicId || null,
              storageProvider: uploadRes.storageProvider || 'cloudinary'
            };
          }
        } catch (uploadErr) {
          console.warn('Failed to upload attachment to Cloudinary:', uploadErr);
          uploadedFileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            url: localPreviewUrl
          };
        }
      } else if (file && file.url) {
        uploadedFileData = file;
      }

      const response = await messageService.sendMessage(convId, {
        content: content || '',
        file: uploadedFileData,
        replyTo,
        clientTempId: tempId,
        isPrivate: !selectedConversation.isGroup,
        recipientId: selectedConversation.targetUserId || null,
        recipientName: selectedConversation.name,
        senderId: isSystemMsg ? 'system' : currentUserId,
        senderName: isSystemMsg ? 'System' : (user?.name || user?.fullName || 'You'),
        messageType: isSystemMsg ? 'system' : 'user'
      });

      const savedMsg = response?.data || response;
      if (savedMsg && (savedMsg.id || savedMsg._id)) {
        setConversationMessages((prev) => ({
          ...prev,
          [convId]: (prev[convId] || []).map((m) =>
            m.id === tempId || m.clientTempId === tempId
              ? {
                  ...m,
                  id: savedMsg.id || savedMsg._id,
                  _id: savedMsg._id || savedMsg.id,
                  clientTempId: tempId,
                  file: savedMsg.file || uploadedFileData || m.file,
                  status: 'delivered',
                  createdAt: savedMsg.timestamp || savedMsg.createdAt || m.createdAt
                }
              : m
          )
        }));
      }
    } catch (err) {
      console.warn('Failed to save message to MongoDB:', err);
      setConversationMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.id === tempId || m.clientTempId === tempId ? { ...m, status: 'delivered' } : m
        )
      }));
    }
  };

  const handleSendTyping = (isTyping) => {
    if (!socket || !isConnected || !selectedConversation) return;
    socket.emit('typing', {
      isTyping,
      conversationId: selectedConversation.id,
      roomId: selectedConversation.id,
      recipientSocketId: selectedConversation.socketId || null
    });
  };

  const handleDeleteMessage = async (messageId, mongoId) => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;

    // Immediately remove from local state
    setConversationMessages((prev) => ({
      ...prev,
      [convId]: (prev[convId] || []).filter(
        (m) =>
          m.id !== messageId &&
          m._id !== messageId &&
          (!mongoId || (m.id !== mongoId && m._id !== mongoId))
      )
    }));

    const targetId = mongoId || messageId;
    const currentUserId = user?.id || user?._id;

    try {
      await messageService.deleteMessage(convId, targetId, {
        alternateId: messageId,
        userId: currentUserId
      });
    } catch (err) {
      console.warn('Failed to delete message in MongoDB:', err);
    }

    if (socket && isConnected) {
      socket.emit('delete-message', {
        messageId: targetId,
        alternateId: messageId,
        conversationId: convId,
        roomId: convId,
        userId: currentUserId
      });
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;
    setConversationMessages((prev) => ({
      ...prev,
      [convId]: (prev[convId] || []).map((m) =>
        (m.id || m._id) === messageId ? { ...m, content: newContent, isEdited: true } : m
      )
    }));

    try {
      await messageService.editMessage(convId, messageId, newContent);
    } catch (err) {
      console.warn('Failed to edit message in MongoDB:', err);
    }

    if (socket && isConnected) {
      socket.emit('edit-message', { messageId, newContent, conversationId: convId, roomId: convId });
    }
  };

  // Toggle reaction per-user: clicking once adds it, clicking again removes it
  const handleMessageReaction = (messageId, emoji) => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;
    const currentUserId = user?.id || user?._id || 'me';
    const currentUserName = user?.name || user?.fullName || 'You';

    // Optimistically toggle reaction on message
    setConversationMessages((prev) => {
      const msgs = prev[convId] || [];
      const updated = msgs.map((m) => {
        if (m.id !== messageId && m._id !== messageId) return m;

        const currentReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
        const existingIdx = currentReactions.findIndex((r) => r.emoji === emoji);

        if (existingIdx !== -1) {
          const target = { ...currentReactions[existingIdx] };
          const users = Array.isArray(target.users) ? [...target.users] : [];
          const userIdx = users.findIndex((u) => {
            const uid = typeof u === 'string' ? u : u.userId || u.id;
            return uid && String(uid) === String(currentUserId);
          });

          const hasReacted = userIdx !== -1 || Boolean(target.hasReacted);

          if (hasReacted) {
            // TOGGLE OFF: User already reacted, so remove reaction
            if (userIdx !== -1) {
              users.splice(userIdx, 1);
            }
            const newCount = (target.count || 1) - 1;
            if (newCount <= 0 || users.length === 0) {
              currentReactions.splice(existingIdx, 1);
            } else {
              currentReactions[existingIdx] = {
                ...target,
                count: newCount,
                users,
                hasReacted: false
              };
            }
          } else {
            // TOGGLE ON: Add user's reaction
            users.push({ userId: currentUserId, userName: currentUserName });
            currentReactions[existingIdx] = {
              ...target,
              count: (target.count || 0) + 1,
              users,
              hasReacted: true
            };
          }
        } else {
          // TOGGLE ON: First reaction with this emoji
          currentReactions.push({
            emoji,
            count: 1,
            users: [{ userId: currentUserId, userName: currentUserName }],
            hasReacted: true
          });
        }

        return {
          ...m,
          reactions: currentReactions
        };
      });

      return {
        ...prev,
        [convId]: updated
      };
    });

    if (socket && isConnected && selectedConversation) {
      socket.emit('message-reaction', {
        messageId,
        emoji,
        conversationId: selectedConversation.id,
        roomId: selectedConversation.id,
        userId: currentUserId,
        userName: currentUserName
      });
    }
  };

  // Launch video call with current selected conversation without pre-scheduling
  const handleCallSelectedConversation = async () => {
    if (!selectedConversation) return;
    const myId = String(user?.id || user?._id || 'host');
    const peerId = String(selectedConversation.targetUserId || selectedConversation.id || 'peer');
    const callSessionId = Date.now().toString(36);
    const cleanRoom = selectedConversation.isGroup
      ? `${(selectedConversation.id || selectedConversation.name || 'group').toLowerCase().replace(/[^a-z0-9]/g, '-')}-video-${callSessionId}`
      : `dm-${[myId, peerId].sort().join('-')}-${callSessionId}`;

    try {
      await meetingService.createInstantMeeting({
        meetingId: cleanRoom,
        title: `${selectedConversation.name || 'Chat'} Video Call`,
        isChatCall: true,
        meetingType: 'chat_call',
        settings: { waitingRoomEnabled: false, isLocked: false }
      });
    } catch {
      // Safe fallback: Room will also auto-register in validateMeetingAccess
    }

    const convId = selectedConversation.id;

    try {
      const roomUrl = `${window.location.origin}/room/${cleanRoom}?convId=${encodeURIComponent(convId)}&callType=video`;
      await handleSendMessage({
        content: `📞 Started a video call. Join here: ${roomUrl}`,
        messageType: 'system'
      });
    } catch (msgErr) {
      console.warn('Could not post video call notification:', msgErr);
    }

    navigate(`/room/${cleanRoom}?convId=${encodeURIComponent(convId)}&callType=video`);
  };

  // Launch voice call with current selected conversation without pre-scheduling
  const handleVoiceCallSelectedConversation = async () => {
    if (!selectedConversation) return;
    const myId = String(user?.id || user?._id || 'host');
    const peerId = String(selectedConversation.targetUserId || selectedConversation.id || 'peer');
    const callSessionId = Date.now().toString(36);
    const cleanRoom = selectedConversation.isGroup
      ? `${(selectedConversation.id || selectedConversation.name || 'group').toLowerCase().replace(/[^a-z0-9]/g, '-')}-voice-${callSessionId}`
      : `voice-${[myId, peerId].sort().join('-')}-${callSessionId}`;

    try {
      await meetingService.createInstantMeeting({
        meetingId: cleanRoom,
        title: `${selectedConversation.name || 'Chat'} Voice Call`,
        isChatCall: true,
        meetingType: 'chat_call',
        settings: { waitingRoomEnabled: false, isLocked: false }
      });
    } catch {
      // Safe fallback: Room will also auto-register in validateMeetingAccess
    }

    const convId = selectedConversation.id;

    try {
      const roomUrl = `${window.location.origin}/room/${cleanRoom}?audioOnly=true&convId=${encodeURIComponent(convId)}&callType=voice`;
      await handleSendMessage({
        content: `📞 Started a voice call. Join here: ${roomUrl}`,
        messageType: 'system'
      });
    } catch (msgErr) {
      console.warn('Could not post voice call notification:', msgErr);
    }

    navigate(`/room/${cleanRoom}?audioOnly=true&convId=${encodeURIComponent(convId)}&callType=voice`);
  };

  // Clear all messages in conversation
  const handleClearChat = async (conversationId) => {
    const convId = (conversationId || selectedConversation?.id || '').toLowerCase().trim();
    if (!convId) return;

    // Track cleared conversation in localStorage so it stays cleared across page refresh
    let clearedConversations = [];
    try {
      clearedConversations = JSON.parse(localStorage.getItem('nexora_cleared_conversations') || '[]');
      if (!Array.isArray(clearedConversations)) clearedConversations = [];
    } catch {}
    if (!clearedConversations.includes(convId)) {
      clearedConversations.push(convId);
      localStorage.setItem('nexora_cleared_conversations', JSON.stringify(clearedConversations));
    }

    // Clear locally immediately
    setConversationMessages((prev) => ({
      ...prev,
      [convId]: []
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, lastMessage: '', timestamp: '' }
          : c
      )
    );

    try {
      await messageService.clearMessages(convId);
      toast.success('Chat history cleared');
    } catch (err) {
      console.warn('Failed to clear messages on backend:', err);
    }

    if (socket && isConnected) {
      socket.emit('clear-chat', { conversationId: convId, roomId: convId });
    }
  };

  // Delete a group conversation entirely
  const handleDeleteGroup = async (conversationId) => {
    const convId = (conversationId || selectedConversation?.id || '').toLowerCase().trim();
    if (!convId) return;

    // Store in deleted groups list to persist deletion across reloads
    let deletedGroups = [];
    try {
      deletedGroups = JSON.parse(localStorage.getItem('nexora_deleted_groups') || '[]');
      if (!Array.isArray(deletedGroups)) deletedGroups = [];
    } catch {}
    if (!deletedGroups.includes(convId)) {
      deletedGroups.push(convId);
      localStorage.setItem('nexora_deleted_groups', JSON.stringify(deletedGroups));
    }

    // Remove from custom groups in localStorage
    try {
      const custom = JSON.parse(localStorage.getItem('nexora_custom_groups') || '[]');
      if (Array.isArray(custom)) {
        const filtered = custom.filter((g) => g.id !== convId);
        localStorage.setItem('nexora_custom_groups', JSON.stringify(filtered));
      }
    } catch {}

    // Remove from conversation list state
    let remainingConversations = [];
    setConversations((prev) => {
      remainingConversations = prev.filter((c) => c.id !== convId);
      return remainingConversations;
    });

    // Clear messages for this room
    setConversationMessages((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });

    // If currently viewing deleted group, switch to first remaining conversation or null
    if (selectedConversation && selectedConversation.id === convId) {
      const fallback = remainingConversations.length > 0 ? remainingConversations[0] : null;
      handleSelectConversation(fallback);
    }

    try {
      await messageService.clearMessages(convId);
      toast.success('Group deleted successfully');
    } catch (err) {
      console.warn('Failed to clean group messages on backend:', err);
    }
  };

  // Toggle pin status for a message
  const handlePinMessage = async (messageId, alternateId) => {
    if (!selectedConversation || !messageId) return;
    const convId = selectedConversation.id;

    // Optimistically toggle isPinned
    let nextPinnedState = true;
    setConversationMessages((prev) => {
      const msgs = prev[convId] || [];
      const updated = msgs.map((m) => {
        if (
          m.id === messageId ||
          m._id === messageId ||
          (alternateId && (m.id === alternateId || m._id === alternateId))
        ) {
          nextPinnedState = !m.isPinned;
          return { ...m, isPinned: nextPinnedState };
        }
        return m;
      });
      return {
        ...prev,
        [convId]: updated
      };
    });

    try {
      const res = await messageService.togglePinMessage(convId, messageId, alternateId);
      const serverPinned = res?.data?.isPinned ?? nextPinnedState;
      toast.success(serverPinned ? 'Message pinned to conversation' : 'Message unpinned');
    } catch (err) {
      console.warn('Failed to toggle message pin in backend:', err);
    }

    if (socket && isConnected) {
      socket.emit('pin-message', {
        messageId,
        alternateId,
        conversationId: convId,
        roomId: convId
      });
    }
  };

  const statistics = [
    {
      label: 'Collaboration Time',
      value: `${(recentMeetings.length * 0.6 + 1.2).toFixed(1)} hrs`,
      change: '+14% this week',
      icon: Clock
    },
    {
      label: 'Conferences Hosted',
      value: `${Math.max(upcomingMeetings.filter((m) => m.isHost).length + recentMeetings.length, 1)}`,
      change: 'Active WebRTC rooms',
      icon: Video
    },
    {
      label: 'Peer Network',
      value: `${Math.max(
        recentMeetings.reduce((acc, curr) => acc + (curr.participants || 1), 0),
        conversations.length
      )}`,
      change: 'Direct contacts linked',
      icon: Users
    },
    {
      label: 'Stream Quality',
      value: '99.9%',
      change: '1080p HD mesh bitrate',
      icon: BarChart3
    }
  ];

  const recentActivities = [
    {
      id: 1,
      action: 'NEXORA Architecture Sync',
      room: 'Team Workspace',
      time: 'Today',
      icon: Calendar
    },
    {
      id: 2,
      action: 'Completed P2P Conference Call',
      room: recentMeetings[0]?.title || 'Sprint Review',
      time: 'Recently',
      icon: Video
    },
    {
      id: 3,
      action: 'WebRTC Signaling Gateway Active',
      room: 'Mesh Mesh Relay',
      time: 'Live',
      icon: Activity
    }
  ];

  // Active messages list for current selected conversation (loaded from MongoDB)
  const currentMessages = selectedConversation
    ? conversationMessages[selectedConversation.id] || []
    : [];

  if (isMessagesView) {
    return (
      <div className="flex-1 h-full min-h-0 flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-dark-950 min-w-0 relative">
        {/* =========================================================================
            1. FIXED GROUP NAMES PANEL (BESIDE SIDEBAR, UNDER NAVBAR)
            ========================================================================= */}
        <div className="w-full md:w-80 lg:w-96 xl:w-96 h-full shrink-0 border-r border-slate-200/80 dark:border-dark-750 bg-white dark:bg-dark-900 flex flex-col overflow-hidden min-h-0 z-10">
          <ConversationPanel
            conversations={conversations}
            selectedId={selectedConversation?.id}
            onSelectConversation={handleSelectConversation}
            onOpenNewConversation={() => setIsNewConversationOpen(true)}
            onDeleteGroup={handleDeleteGroup}
            isLoading={isConversationsLoading}
            initialTab={activeConvTab}
          />
        </div>

        {/* =========================================================================
            2. CHAT PANEL (WHERE USER SENDS & SEES MESSAGES)
            ========================================================================= */}
        <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden relative bg-slate-50 dark:bg-dark-950">
          {selectedConversation ? (
            <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-dark-950 min-h-0 relative z-10">
              <RealtimeChatInterface
                conversation={selectedConversation}
                messages={currentMessages}
                onSendMessage={handleSendMessage}
                onTyping={handleSendTyping}
                typingUsers={typingUsers}
                currentUserId={user?.id || user?._id}
                onReaction={handleMessageReaction}
                onDeleteMessage={handleDeleteMessage}
                onEditMessage={handleEditMessage}
                onPinMessage={handlePinMessage}
                onClearChat={handleClearChat}
                onDeleteGroup={handleDeleteGroup}
                onStartVideoCall={handleCallSelectedConversation}
                onStartVoiceCall={handleVoiceCallSelectedConversation}
                onClose={() => setSelectedConversation(null)}
                isLoading={isMessagesLoading}
                hasMoreMessages={Boolean(conversationPagination[selectedConversation?.id]?.hasMore)}
                isLoadingOlder={Boolean(isLoadingOlder[selectedConversation?.id])}
                onLoadOlderMessages={handleLoadOlderMessages}
              />
            </div>
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-dark-950/50">
              <div className="w-16 h-16 rounded-3xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Your Conversations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Select an existing conversation from the list to start messaging, or create a new direct message or group channel.
              </p>
              <Button
                variant="gradient"
                size="sm"
                className="mt-5 cursor-pointer"
                onClick={() => setIsNewConversationOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Start New Conversation
              </Button>
            </div>
          )}
        </div>

        {/* Global Modals */}
        <CreateMeetingModal
          isOpen={isCreateOpen}
          initialTab={createInitialTab}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleMeetingCreated}
        />

        <JoinMeetingModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
        />

        <NewConversationModal
          isOpen={isNewConversationOpen}
          onClose={() => setIsNewConversationOpen(false)}
          onStartDirectConversation={handleStartDirectConversation}
          onCreateGroupRoom={handleCreateGroupRoom}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-dark-950 min-w-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto w-full">
        {/* Hero Welcome Card with Custom Geometric NEXORA Graphic */}
        <NexoraConstellationHero
          user={user}
          isConnected={isConnected}
          onStartInstant={handleStartInstant}
          onOpenSchedule={openScheduleModal}
          onOpenNewChat={() => navigate('/messages?action=new')}
          isInstantStarting={isInstantStarting}
        />

            {/* Quick Action Cards: Start Instant & Join Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quick Launch Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card flex flex-col justify-between hover:border-brand-500/40 transition nx-card-interactive">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center shadow-sm">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Launch Instant Conference
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Create an encrypted WebRTC room in one click
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleStartInstant} className="space-y-3 mb-4">
                    <Input
                      placeholder="Meeting Title (optional, e.g. Sprint Sync)"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="gradient"
                      size="md"
                      className="w-full"
                      isLoading={isInstantStarting}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start Conference
                    </Button>
                  </form>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-dark-750 flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Direct peer-to-peer audio, video, & screen sharing</span>
                </div>
              </div>

              {/* Join Meeting Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card flex flex-col justify-between hover:border-brand-500/40 transition nx-card-interactive">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-sm">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Join with Code or Link
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Jump straight into an ongoing meeting
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleJoinMeeting} className="space-y-3 mb-4">
                    <Input
                      placeholder="Enter room code (e.g. 9b3f-42e1-7c8a)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        variant="secondary"
                        size="md"
                        className="flex-1"
                        disabled={!joinCode.trim()}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Join Room
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => setIsJoinModalOpen(true)}
                        title="Advanced Join with Password"
                      >
                        Options
                      </Button>
                    </div>
                  </form>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-dark-750 flex items-center gap-2 text-xs text-slate-400">
                  <span>Enter room code or paste meeting invite link</span>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statistics.map((stat, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card hover:border-brand-500/30 transition"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-semibold">{stat.label}</span>
                    <stat.icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{stat.change}</div>
                </div>
              ))}
            </div>

            {/* Two-Column Section: Upcoming Meetings & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upcoming Meetings (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Upcoming Meetings
                      </h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={openScheduleModal}>
                      + Schedule
                    </Button>
                  </div>

                  {upcomingMeetings.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No upcoming meetings scheduled. Click Schedule to plan one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingMeetings.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="p-4 rounded-2xl bg-slate-50/70 dark:bg-dark-850/70 border border-slate-200/80 dark:border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-brand-500/40 transition shadow-subtle"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {meeting.title}
                              </span>
                              {meeting.isHost && (
                                <Badge variant="primary" size="sm">
                                  Host
                                </Badge>
                              )}
                              {meeting.isPasswordProtected && (
                                <Badge variant="warning" size="sm">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Passcode
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                                {meeting.date} at {meeting.time}
                              </span>
                              <span>•</span>
                              <span>{meeting.duration}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {meeting.participantsCount} expected
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCopyCode(meeting.meetingId || meeting.roomId)}
                              title="Copy meeting link"
                            >
                              {copiedId === (meeting.meetingId || meeting.roomId) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                navigate(`/meeting/${meeting.meetingId || meeting.roomId}`)
                              }
                              title="Meeting Details & Settings"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                            {meeting.isHost && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleCancelMeeting(meeting.meetingId || meeting.roomId)
                                }
                                title="Cancel scheduled meeting"
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/room/${meeting.meetingId || meeting.roomId}`)}
                            >
                              Start Call
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Meetings */}
                <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-500" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Recent Meetings
                      </h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
                      View Full History
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-dark-750">
                    {recentMeetings.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No past meeting records found yet.
                      </div>
                    ) : (
                      recentMeetings.map((rec) => (
                        <div
                          key={rec.id}
                          className="py-3.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {rec.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {rec.date} • {rec.duration} • {rec.participants} participants
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/meeting/${rec.meetingId || rec.roomId}`)}
                              title="View Meeting Details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/room/${rec.meetingId || rec.roomId}`)}
                            >
                              Re-join
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Feed & Personal Permanent Link (1 Col) */}
              <div className="space-y-6">
                <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 shadow-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                      Recent Activity
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {recentActivities.map((act) => (
                      <div key={act.id} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                          <act.icon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {act.action}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {act.room} • {act.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Personal Permanent Meeting Link Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-50/70 via-white to-slate-50 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 border border-brand-200/80 dark:border-brand-900/60 shadow-card space-y-3">
                  <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Personal Meeting Link</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your dedicated permanent invite link for quick 1:1 syncs.
                  </p>
                  <div className="text-xs font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-dark-900 p-2.5 rounded-xl border border-slate-200/90 dark:border-dark-750 truncate shadow-subtle">
                    {window.location.origin}/room/
                    {user?.name ? user.name.toLowerCase().replace(/\s+/g, '-') : 'my-room'}
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const link = `${window.location.origin}/room/${
                        user?.name ? user.name.toLowerCase().replace(/\s+/g, '-') : 'my-room'
                      }`;
                      navigator.clipboard.writeText(link);
                      setCopiedId('permanent');
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                  >
                    {copiedId === 'permanent' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {copiedId === 'permanent' ? 'Copied Link' : 'Copy Permanent Link'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

      {/* Global Modals */}
      <CreateMeetingModal
        isOpen={isCreateOpen}
        initialTab={createInitialTab}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleMeetingCreated}
      />

      <JoinMeetingModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />

      <NewConversationModal
        isOpen={isNewConversationOpen}
        onClose={() => setIsNewConversationOpen(false)}
        onStartDirectConversation={handleStartDirectConversation}
        onCreateGroupRoom={handleCreateGroupRoom}
      />

      {/* Modern Confirmation Dialog for Meeting Cancellation */}
      <ConfirmDialog
        isOpen={Boolean(meetingToCancel)}
        onClose={() => setMeetingToCancel(null)}
        onConfirm={async () => {
          if (!meetingToCancel) return;
          const mId = meetingToCancel;
          setMeetingToCancel(null);
          try {
            await meetingService.cancelMeeting(mId);
            setUpcomingMeetings((prev) => prev.filter((m) => (m.meetingId || m.roomId) !== mId));
            toast.success('Scheduled meeting cancelled');
          } catch (err) {
            toast.error(err.message || 'Failed to cancel meeting.');
          }
        }}
        title="Cancel Scheduled Meeting"
        description="Are you sure you want to cancel this scheduled meeting? Attendees will be notified."
        confirmText="Cancel Meeting"
        cancelText="Keep Meeting"
        type="danger"
      />
    </div>
  );
};

export default Dashboard;
