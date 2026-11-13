import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send,
  Smile,
  Paperclip,
  Search,
  X,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  MoreVertical,
  Check,
  CheckCheck,
  Copy,
  Reply,
  Trash2,
  ArrowLeft,
  BellOff,
  Bell,
  UsersRound,
  FileText,
  Loader2,
  ArrowUp,
  Pin
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import ConfirmDialog from '../common/ConfirmDialog';
import { MessageSkeleton } from '../common/Skeleton';
import { EMOJI_CATEGORIES } from '../../utils/constants';
import ChatAttachment, { ImageLightboxModal } from './ChatAttachment';

export { EMOJI_CATEGORIES };

export const getDateSeparatorLabel = (dateInput) => {
  if (!dateInput) return 'Today';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Today';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return messageDay.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: messageDay.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};

export const formatLastSeen = (lastSeenDate, isOnline, isGroup) => {
  if (isGroup) return 'Team Mesh Channel • Encrypted Space';
  if (isOnline) return 'Online now';
  if (!lastSeenDate) return 'Offline';

  const date = new Date(lastSeenDate);
  if (isNaN(date.getTime())) return 'Offline';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Active just now';
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;

  const isToday = now.toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Last seen today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `Last seen yesterday at ${timeStr}`;
  }

  return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

const RealtimeChatInterface = ({
  conversation,
  messages = [],
  onSendMessage,
  onTyping,
  typingUsers = [],
  currentUserId,
  onReaction,
  onDeleteMessage,
  onEditMessage,
  onPinMessage,
  onClearChat,
  onDeleteGroup,
  onStartVideoCall,
  onStartVoiceCall,
  onClose,
  isLoading = false,
  hasMoreMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages
}) => {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeReactionMenuId, setActiveReactionMenuId] = useState(null);
  const [reactionCategoryIndex, setReactionCategoryIndex] = useState(0);
  const [activeLightboxFile, setActiveLightboxFile] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    type: 'danger',
    onConfirm: () => {}
  });

  // Latest pinned message in this conversation
  const pinnedMessage = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const pinned = messages.filter((m) => Boolean(m.isPinned));
    return pinned.length > 0 ? pinned[pinned.length - 1] : null;
  }, [messages]);

  const handleAddReaction = (msgId, emoji) => {
    setActiveReactionMenuId(null);
    if (onReaction) onReaction(msgId, emoji);
  };

  // Close emoji pickers on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !e.target.closest('[data-emoji-trigger="composer"]')
      ) {
        setShowEmojiPicker(false);
      }
      if (
        activeReactionMenuId &&
        !e.target.closest('[data-reaction-menu="true"]') &&
        !e.target.closest('[data-reaction-trigger="true"]')
      ) {
        setActiveReactionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeReactionMenuId, showEmojiPicker]);

  // Direct Emoji Panel for message reactions (opened when user clicks the emoji icon)
  const renderReactionPopover = (msg, isMe) => {
    const msgId = msg.id || msg._id;
    if (activeReactionMenuId !== msgId) return null;

    return (
      <div
        data-reaction-menu="true"
        className={`absolute bottom-full mb-2 z-40 w-72 max-w-[85vw] p-2.5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 shadow-elevated animate-fade-in ${
          isMe ? 'right-0' : 'left-0'
        }`}
      >
        {/* Category Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-750 pb-2 mb-2 select-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {EMOJI_CATEGORIES[reactionCategoryIndex].name}
          </span>
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReactionCategoryIndex(idx);
                }}
                title={cat.name}
                className={`px-1.5 py-0.5 rounded text-xs transition cursor-pointer ${
                  reactionCategoryIndex === idx
                    ? 'bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-300 font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                {cat.emojis[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Emoji Grid */}
        <div className="grid grid-cols-7 gap-1 max-h-44 overflow-y-auto p-0.5">
          {EMOJI_CATEGORIES[reactionCategoryIndex].emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddReaction(msgId, emoji)}
              className="p-1.5 text-lg rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition transform hover:scale-125 cursor-pointer text-center flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const optionsMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimerRef = useRef(null);

  const previousScrollHeightRef = useRef(null);
  const isPrependingRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const activeConversationIdRef = useRef(null);

  // Auto-scroll logic strictly scoped to message container (prevents window scrolling)
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (behavior === 'smooth') {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({
          behavior: behavior === 'smooth' ? 'smooth' : 'auto',
          block: 'end'
        });
      } catch {
        // Fallback to container scrollTop
      }
    }
  }, []);

  // Reset initial scroll flag whenever active conversation changes
  useEffect(() => {
    if (conversation?.id !== activeConversationIdRef.current) {
      activeConversationIdRef.current = conversation?.id;
      initialScrollDoneRef.current = false;
    }
  }, [conversation?.id]);

  // Primary: Scroll to bottom immediately upon page open, refresh, or conversation load
  useLayoutEffect(() => {
    if (isPrependingRef.current) return;

    if (!isLoading && messages.length > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;

      // Instant scroll to the end of the chat
      scrollToBottom('auto');

      const raf = requestAnimationFrame(() => {
        scrollToBottom('auto');
      });

      // Staged timeouts to ensure any dynamic rendering (avatars, attachments, layout wraps) stays pinned to bottom
      const t1 = setTimeout(() => scrollToBottom('auto'), 40);
      const t2 = setTimeout(() => scrollToBottom('auto'), 120);
      const t3 = setTimeout(() => scrollToBottom('auto'), 250);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [conversation?.id, isLoading, messages.length, scrollToBottom]);

  // Auto-scroll when new messages arrive or user sends a message
  useEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }

    // Let initial load effect handle the first positioning
    if (!initialScrollDoneRef.current) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 260;
    const lastMsg = messages[messages.length - 1];
    const isMyMessage = lastMsg && (lastMsg.isMe || lastMsg.senderId === currentUserId);

    if (isNearBottom || isMyMessage) {
      scrollToBottom('smooth');
    }
  }, [messages.length, typingUsers.length, selectedFile, currentUserId, scrollToBottom]);

  // Re-scroll to bottom when chat attachments / images finish loading if user was near bottom
  useEffect(() => {
    const handleAttachmentLoaded = () => {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        if (isNearBottom) {
          scrollToBottom('auto');
        }
      }
    };
    window.addEventListener('nx-chat-attachment-loaded', handleAttachmentLoaded);
    return () => window.removeEventListener('nx-chat-attachment-loaded', handleAttachmentLoaded);
  }, [scrollToBottom]);

  // Maintain scroll anchor when older history is prepended
  useLayoutEffect(() => {
    if (previousScrollHeightRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const newScrollHeight = container.scrollHeight;
      const diff = newScrollHeight - previousScrollHeightRef.current;
      if (diff > 0) {
        container.scrollTop = diff;
      }
      previousScrollHeightRef.current = null;
    }
  }, [messages]);

  // Scroll detection to fetch older history when user scrolls up
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight } = e.currentTarget;
    if (scrollTop < 70 && hasMoreMessages && !isLoadingOlder && onLoadOlderMessages) {
      previousScrollHeightRef.current = scrollHeight;
      isPrependingRef.current = true;
      onLoadOlderMessages();
    }
  };

  const handleManualLoadOlder = () => {
    if (messagesContainerRef.current) {
      previousScrollHeightRef.current = messagesContainerRef.current.scrollHeight;
      isPrependingRef.current = true;
    }
    if (onLoadOlderMessages) onLoadOlderMessages();
  };

  // Handle outside click for menus
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle Ctrl+F / Cmd+F to open conversation search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setShowEmojiPicker(false);
        setShowOptionsMenu(false);
        setReplyingTo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-resize textarea smoothly up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
    }
  }, [inputText]);

  // Reset reply, attachment preview, and edit state when active conversation switches
  useEffect(() => {
    setReplyingTo(null);
    setSelectedFile(null);
    setEditingMessage(null);
    setInputText('');
  }, [conversation?.id]);

  // Focus textarea when conversation, reply, or edit changes without scrolling ancestors
  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, [conversation?.id, replyingTo, editingMessage]);

  // Generate and cleanup object URLs for file previews
  useEffect(() => {
    if (!selectedFile) {
      setFilePreviewUrl(null);
      return;
    }

    if (selectedFile.type?.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreviewUrl(null);
    }
  }, [selectedFile]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    if (onTyping) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    // Enter sends message, Shift + Enter creates a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && !selectedFile) || isSending) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (onTyping) onTyping(false);

    setIsSending(true);

    try {
      if (editingMessage && onEditMessage) {
        await onEditMessage(editingMessage.id || editingMessage._id, trimmed);
        setEditingMessage(null);
        setInputText('');
      } else if (onSendMessage) {
        await onSendMessage({
          content: trimmed,
          file: selectedFile,
          replyTo: replyingTo
        });
        setInputText('');
        setSelectedFile(null);
        setReplyingTo(null);
        setShowEmojiPicker(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleInsertEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleCopyText = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setInputText(msg.content);
    setReplyingTo(null);
  };

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => {
      const contentMatch = m.content?.toLowerCase().includes(q);
      const senderMatch =
        m.senderName?.toLowerCase().includes(q) || m.sender?.toLowerCase().includes(q);
      return contentMatch || senderMatch;
    });
  }, [messages, searchQuery]);

  // Compute consecutive message groupings and date separators
  const renderedMessageItems = useMemo(() => {
    const items = [];
    let lastDateStr = null;

    filteredMessages.forEach((msg, idx) => {
      const msgDate = msg.createdAt || msg.timestamp || new Date();
      const dateLabel = getDateSeparatorLabel(msgDate);

      // Insert date divider when day changes
      if (dateLabel !== lastDateStr) {
        items.push({
          type: 'date-separator',
          id: `sep-${dateLabel}-${idx}`,
          label: dateLabel
        });
        lastDateStr = dateLabel;
      }

      const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
      const isSameSenderAsPrev =
        prevMsg &&
        (msg.isMe === prevMsg.isMe &&
          (msg.senderId === prevMsg.senderId || msg.sender === prevMsg.sender));

      // Group consecutive messages if sent within 3 minutes by same sender
      const prevDate = prevMsg ? new Date(prevMsg.createdAt || prevMsg.timestamp) : null;
      const currDate = new Date(msgDate);
      const timeDiff = prevDate && !isNaN(prevDate) && !isNaN(currDate) ? currDate - prevDate : 999999;
      const isConsecutive = isSameSenderAsPrev && timeDiff < 180000;

      items.push({
        type: 'message',
        data: msg,
        isConsecutive
      });
    });

    return items;
  }, [filteredMessages]);

  return (
    <div className="w-full flex-1 h-full min-w-0 flex flex-col bg-slate-50/70 dark:bg-dark-950 select-text overflow-hidden relative">
      {/* =========================================================================
          1. CHAT HEADER
          ========================================================================= */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white dark:bg-dark-900 border-b border-slate-200/80 dark:border-dark-750 flex items-center justify-between shrink-0 shadow-subtle z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Back button on mobile with comfortable 44px touch target */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-dark-800 md:hidden cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* User Avatar with status dot */}
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow-sm ${
                conversation?.isGroup
                  ? 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 shadow-glow'
                  : 'bg-gradient-to-tr from-brand-600 to-violet-600 shadow-glow'
              }`}
            >
              {conversation?.isGroup ? (
                <UsersRound className="w-4 h-4 text-white" />
              ) : (
                conversation?.avatarText || conversation?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>

            {/* Live presence status dot */}
            {!conversation?.isGroup && (
              <span
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 ${
                  conversation?.isOnline
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : conversation?.status === 'away'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                title={conversation?.isOnline ? 'Online now' : 'Offline'}
              />
            )}
          </div>

          {/* User Name & Last Seen Information */}
          <div className="min-w-0 flex-1 truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight font-heading">
                {conversation?.name || 'Conversation'}
              </h3>
              {conversation?.isGroup && (
                <Badge variant="violet" size="sm" className="hidden sm:inline-flex">
                  Team Mesh
                </Badge>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
              {formatLastSeen(
                conversation?.lastSeen,
                Boolean(conversation?.isOnline),
                Boolean(conversation?.isGroup)
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Voice Call, Video Call, Search, Options */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Voice Call Button */}
          {onStartVoiceCall && (
            <button
              onClick={onStartVoiceCall}
              title="Start Voice Call"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-dark-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Video Call Button */}
          {onStartVideoCall && (
            <>
              <button
                onClick={onStartVideoCall}
                title="Start Video Call"
                className="p-2 rounded-xl text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 transition cursor-pointer sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Video className="w-4 h-4" />
              </button>
              <Button
                variant="gradient"
                size="sm"
                onClick={onStartVideoCall}
                className="hidden sm:inline-flex shadow-sm gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Call</span>
              </Button>
            </>
          )}

          {/* Search within conversation */}
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            title="Search in conversation (Ctrl+F)"
            className={`p-2 rounded-xl transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
              isSearchOpen
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-dark-800'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* More Options Dropdown */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              title="More options"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-dark-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-modal py-1.5 z-30 animate-fade-in text-xs">
                <button
                  onClick={() => {
                    setIsMuted((prev) => !prev);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-dark-850 text-slate-700 dark:text-slate-300 transition"
                >
                  {isMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                </button>

                <button
                  onClick={() => {
                    handleCopyText(window.location.href, 'chat-url');
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-dark-850 text-slate-700 dark:text-slate-300 transition"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Channel Link</span>
                </button>

                {onClearChat && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setConfirmModal({
                        isOpen: true,
                        title: 'Clear Chat History',
                        description: 'Are you sure you want to clear all messages in this conversation? All messages will be permanently removed for everyone.',
                        confirmText: 'Clear Chat',
                        type: 'danger',
                        onConfirm: () => onClearChat(conversation.id)
                      });
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Chat History</span>
                  </button>
                )}

                {conversation?.isGroup && onDeleteGroup && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setConfirmModal({
                        isOpen: true,
                        title: 'Delete Group',
                        description: `Are you sure you want to delete "${conversation.name || 'this group'}"? All group messages and channels will be permanently removed.`,
                        confirmText: 'Delete Group',
                        type: 'danger',
                        onConfirm: () => onDeleteGroup(conversation.id)
                      });
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-dark-750" />

                <button
                  onClick={() => {
                    if (onClose) onClose();
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-dark-850 text-slate-700 dark:text-slate-300 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Bar Sub-Header */}
      {isSearchOpen && (
        <div className="px-4 py-2.5 bg-brand-50/70 dark:bg-dark-900 border-b border-brand-200/70 dark:border-dark-750 flex items-center gap-2 animate-fade-in z-10">
          <Search className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <input
            type="text"
            placeholder="Search messages in this conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 shrink-0">
              {filteredMessages.length} {filteredMessages.length === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pinned Message Sticky Banner */}
      {pinnedMessage && (
        <div
          onClick={() => {
            const targetEl = document.getElementById(`msg-${pinnedMessage.id || pinnedMessage._id}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.add('ring-2', 'ring-amber-400', 'rounded-2xl');
              setTimeout(() => {
                targetEl.classList.remove('ring-2', 'ring-amber-400', 'rounded-2xl');
              }, 2000);
            }
          }}
          className="px-4 py-2 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent dark:from-amber-500/20 dark:via-amber-500/10 dark:to-transparent border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-amber-500/20 transition z-10 shrink-0 select-none animate-fade-in"
          title="Click to jump to pinned message"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 transform -rotate-45" />
            <div className="min-w-0 flex items-baseline gap-1.5 truncate">
              <span className="font-bold text-amber-700 dark:text-amber-400 text-[11px] shrink-0">
                Pinned Message:
              </span>
              <span className="text-slate-700 dark:text-slate-300 truncate text-[11px]">
                <span className="font-semibold text-slate-900 dark:text-white mr-1">
                  {pinnedMessage.senderName || pinnedMessage.sender}:
                </span>
                {pinnedMessage.content || (pinnedMessage.file ? `[Attachment: ${pinnedMessage.file.name || 'File'}]` : '')}
              </span>
            </div>
          </div>
          {onPinMessage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPinMessage(pinnedMessage.id || pinnedMessage._id, pinnedMessage._id || pinnedMessage.id);
              }}
              title="Unpin message"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          2. MESSAGE AREA (Strict internal scrolling with min-h-0)
          ========================================================================= */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto space-y-2 relative overscroll-contain"
      >
        {/* Older messages loader / trigger indicator */}
        {hasMoreMessages && (
          <div className="py-2.5 text-center shrink-0">
            {isLoadingOlder ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 text-xs shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600 dark:text-brand-400" />
                <span>Loading earlier history from MongoDB...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleManualLoadOlder}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-300 text-xs transition cursor-pointer font-medium border border-slate-200/60 dark:border-dark-700 shadow-subtle"
              >
                <ArrowUp className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                <span>Load earlier messages</span>
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          /* Premium Shimmer Message Skeletons */
          <MessageSkeleton />
        ) : filteredMessages.length === 0 ? (
          /* Custom NEXORA Empty State */
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-6 space-y-4">
            <EmptyState
              illustration={searchQuery ? 'search' : 'messages'}
              title={
                searchQuery
                  ? 'No matching messages found'
                  : `Start chatting with ${conversation?.name || 'this contact'}`
              }
              description={
                searchQuery
                  ? `No messages matched "${searchQuery}". Try searching for another phrase.`
                  : 'Messages are encrypted end-to-end and transmitted over secure WebRTC signaling.'
              }
            />
            {!searchQuery && (
              <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-2">
                {['👋 Hey there!', 'Ready for our sync?', 'Can we jump on a call?'].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus({ preventScroll: true });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 hover:border-brand-500 text-xs text-slate-700 dark:text-slate-300 transition shadow-subtle cursor-pointer hover:scale-105 active:scale-95"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          renderedMessageItems.map((item) => {
            // Render Date Separator
            if (item.type === 'date-separator') {
              return (
                <div key={item.id} className="flex items-center justify-center my-4">
                  <div className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-200/60 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-dark-750 shadow-subtle">
                    {item.label}
                  </div>
                </div>
              );
            }

            // Render Message Bubble
            const msg = item.data;
            const isSystem = Boolean(
              msg.messageType === 'system' ||
              msg.isSystem ||
              msg.senderId === 'system' ||
              msg.sender === 'System' ||
              msg.senderName === 'System' ||
              (typeof msg.content === 'string' && (
                msg.content.startsWith('📞') ||
                msg.content.includes('Started a voice call') ||
                msg.content.includes('Started a video call') ||
                msg.content.startsWith('User joined') ||
                msg.content.startsWith('User left')
              ))
            );

            // System Message: Centered in the middle of the chat
            if (isSystem) {
              const urlMatch = typeof msg.content === 'string' ? msg.content.match(/(https?:\/\/[^\s]+)/) : null;
              const joinUrl = urlMatch ? urlMatch[0] : null;
              const textBeforeUrl = joinUrl
                ? msg.content.replace(joinUrl, '').replace(/Join here:\s*$/, '').trim()
                : msg.content;

              // Check if this specific call has ended
              const roomMatch = joinUrl ? joinUrl.match(/\/room\/([a-zA-Z0-9_-]+)/) : null;
              const callRoomId = roomMatch ? roomMatch[1] : null;

              const isEnded = Boolean(
                msg.isCallEnded ||
                msg.callStatus === 'ended' ||
                (callRoomId && (
                  sessionStorage.getItem(`ended_call_${callRoomId}`) === 'true' ||
                  localStorage.getItem(`ended_call_${callRoomId}`) === 'true'
                ))
              );

              return (
                <div key={msg.id || msg._id} className="flex justify-center my-3 w-full select-none px-4 animate-fade-in">
                  <div className="px-4 py-1.5 rounded-full bg-slate-200/80 dark:bg-dark-800/90 text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-dark-700/60 text-[11px] font-medium shadow-xs text-center max-w-[85%] break-words inline-flex flex-wrap items-center justify-center gap-2">
                    <span>{textBeforeUrl}</span>
                    {joinUrl && (
                      isEnded ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-300/80 dark:bg-dark-700 text-slate-500 dark:text-slate-400 font-semibold text-[10px] cursor-not-allowed border border-slate-400/30 dark:border-dark-600/50 select-none shadow-none"
                          title="This call has ended"
                        >
                          <PhoneOff className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>Call Ended</span>
                        </span>
                      ) : (
                        <a
                          href={joinUrl}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-semibold text-[10px] transition shadow-xs cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Join Call</span>
                        </a>
                      )
                    )}
                    {msg.timestamp && (
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">
                        • {msg.timestamp}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            const isMe = Boolean(
              msg.isMe ||
              (currentUserId && msg.senderId && String(msg.senderId) === String(currentUserId))
            );
            const isConsecutive = item.isConsecutive;

            return (
              <div
                key={msg.id || msg._id}
                id={'msg-' + (msg.id || msg._id)}
                className={`group relative flex items-end gap-2.5 ${
                  isMe ? 'justify-end' : 'justify-start'
                } ${isConsecutive ? 'mt-1' : 'mt-3'}`}
              >
                {/* Incoming Peer Avatar (omitted when consecutive) */}
                {!isMe && (
                  <div className="w-7 h-7 shrink-0 mb-0.5">
                    {!isConsecutive ? (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                        {msg.sender?.charAt(0) || msg.senderName?.charAt(0) || 'P'}
                      </div>
                    ) : (
                      <div className="w-7 h-7" />
                    )}
                  </div>
                )}

                {/* User's Message (isMe): Action Menu & Emojis shown to the LEFT of user's message */}
                {isMe && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 select-none">
                    {/* Quick Reaction Trigger & Popover (Opens anchored to right, expanding leftwards) */}
                    <div className="relative">
                      <button
                        type="button"
                        data-reaction-trigger="true"
                        onClick={() => {
                          const targetId = msg.id || msg._id;
                          if (activeReactionMenuId === targetId) {
                            setActiveReactionMenuId(null);
                          } else {
                            setActiveReactionMenuId(targetId);
                          }
                        }}
                        title="React to message"
                        className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-amber-500 shadow-sm transition cursor-pointer"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      {renderReactionPopover(msg, true)}
                    </div>

                    {onPinMessage && (
                      <button
                        type="button"
                        onClick={() => onPinMessage(msg.id || msg._id, msg._id || msg.id)}
                        title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                        className={`p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 shadow-sm transition cursor-pointer ${
                          msg.isPinned
                            ? 'text-amber-500 border-amber-300 dark:border-amber-600/50'
                            : 'text-slate-500 hover:text-amber-500'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setReplyingTo(msg)}
                      title="Reply"
                      className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-brand-600 shadow-sm transition cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.content, msg.id || msg._id)}
                      title="Copy text"
                      className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-brand-600 shadow-sm transition cursor-pointer"
                    >
                      {copiedId === (msg.id || msg._id) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {onDeleteMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: 'Delete Message',
                            description: 'Are you sure you want to delete this message? It will be removed for everyone in this conversation.',
                            confirmText: 'Delete Message',
                            type: 'danger',
                            onConfirm: () => onDeleteMessage(msg.id || msg._id, msg._id || msg.id)
                          });
                        }}
                        title="Delete message"
                        className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-rose-500 shadow-sm transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] p-3 sm:p-3.5 transition-all duration-150 ${
                    isMe
                      ? `nx-bubble-outgoing ${
                          isConsecutive ? 'nx-bubble-outgoing-consecutive' : ''
                        }`
                      : `nx-bubble-incoming border border-slate-200/60 dark:border-dark-750 text-slate-900 dark:text-slate-100 ${
                          isConsecutive ? 'nx-bubble-incoming-consecutive' : ''
                        }`
                  }`}
                >
                  {/* Pinned Badge */}
                  {msg.isPinned && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 dark:text-amber-400 mb-1 select-none">
                      <Pin className="w-3 h-3 fill-amber-500 transform -rotate-45" />
                      <span>Pinned</span>
                    </div>
                  )}

                  {/* Sender Name in group / channels (only when not consecutive) */}
                  {!isMe && !isConsecutive && (
                    <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 mb-1">
                      {msg.senderName || msg.sender}
                    </div>
                  )}

                  {/* Quoted / Reply Preview */}
                  {msg.replyTo && (
                    <div
                      className={`mb-2 p-2 rounded-xl text-xs border-l-2 ${
                        isMe
                          ? 'bg-white/10 border-white/80 text-white/90'
                          : 'bg-slate-100 dark:bg-dark-850 border-brand-500 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-[10px]">{msg.replyTo.sender || msg.replyTo.senderName || 'Participant'}</p>
                      <p className="truncate text-[11px]">
                        {msg.replyTo.content && !msg.replyTo.content.startsWith('[Attachment:')
                          ? msg.replyTo.content
                          : '📎 Attachment'}
                      </p>
                    </div>
                  )}

                  {/* File / Media Attachment Display */}
                  {msg.file && (
                    <ChatAttachment
                      file={msg.file}
                      isMe={isMe}
                      onOpenLightbox={(f) => setActiveLightboxFile(f)}
                    />
                  )}

                  {/* Text Content (suppress redundant [Attachment: ...] label when media is present) */}
                  {msg.content && (!msg.file || (!msg.content.startsWith('[Attachment:') && !msg.content.startsWith('Attachment:'))) && (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text break-words">
                      {msg.content}
                    </p>
                  )}

                  {/* Message Reactions Display (Per-user toggleable reaction pills) */}
                  {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                      {msg.reactions.map((r, rIdx) => (
                        <button
                          key={`${r.emoji}-${rIdx}`}
                          type="button"
                          onClick={() => handleAddReaction(msg.id || msg._id, r.emoji)}
                          title={r.hasReacted ? 'Click to remove your reaction' : 'Click to react'}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-all hover:scale-110 active:scale-95 cursor-pointer select-none ${
                            r.hasReacted
                              ? 'bg-amber-400/25 border-amber-400/80 text-amber-900 dark:text-amber-200 font-bold shadow-xs'
                              : 'bg-white/20 dark:bg-black/20 text-slate-600 dark:text-slate-300 border-white/20 dark:border-white/10 hover:border-amber-400/50'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bottom Metadata: Timestamp & Status Indicator */}
                  <div
                    className={`text-[9px] mt-1.5 flex items-center justify-end gap-1.5 select-none ${
                      isMe ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    {msg.isEdited && <span className="italic">edited</span>}
                    <span>{msg.timestamp || 'Now'}</span>

                    {/* Delivery Status Indicator for Outgoing Messages */}
                    {isMe && (
                      <span title={msg.status === 'read' ? 'Read by recipient' : 'Delivered'}>
                        {msg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-200 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-white/90" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-white/70" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Other User's Message (!isMe): Action Menu & Emojis shown to the RIGHT of other's message */}
                {!isMe && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 select-none">
                    {/* Quick Reaction Trigger & Popover (Opens anchored to left, expanding rightwards) */}
                    <div className="relative">
                      <button
                        type="button"
                        data-reaction-trigger="true"
                        onClick={() => {
                          const targetId = msg.id || msg._id;
                          if (activeReactionMenuId === targetId) {
                            setActiveReactionMenuId(null);
                          } else {
                            setActiveReactionMenuId(targetId);
                          }
                        }}
                        title="React to message"
                        className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-amber-500 shadow-sm transition cursor-pointer"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      {renderReactionPopover(msg, false)}
                    </div>

                    {onPinMessage && (
                      <button
                        type="button"
                        onClick={() => onPinMessage(msg.id || msg._id, msg._id || msg.id)}
                        title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                        className={`p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 shadow-sm transition cursor-pointer ${
                          msg.isPinned
                            ? 'text-amber-500 border-amber-300 dark:border-amber-600/50'
                            : 'text-slate-500 hover:text-amber-500'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setReplyingTo(msg)}
                      title="Reply"
                      className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-brand-600 shadow-sm transition cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.content, msg.id || msg._id)}
                      title="Copy text"
                      className="p-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-slate-500 hover:text-brand-600 shadow-sm transition cursor-pointer"
                    >
                      {copiedId === (msg.id || msg._id) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400 animate-fade-in pl-10">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 shadow-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[11px] font-medium ml-1.5 text-slate-600 dark:text-slate-300">
                {typingUsers.map((u) => u.userName || 'Peer').join(', ')} is typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* =========================================================================
          3. MESSAGE COMPOSER (RIGIDLY ANCHORED AT BOTTOM)
          ========================================================================= */}
      <footer className="relative p-2 sm:p-3 bg-white dark:bg-dark-900 border-t border-slate-200/80 dark:border-dark-750 shrink-0 z-20 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-2 truncate">
              <Reply className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Replying to {replyingTo.senderName || replyingTo.sender || 'Participant'}:
              </span>
              <span className="truncate text-slate-500 dark:text-slate-400">
                {replyingTo.content && !replyingTo.content.startsWith('[Attachment:')
                  ? replyingTo.content
                  : (replyingTo.file ? `📎 ${replyingTo.file.name || 'Attachment'}` : '📎 Attachment')}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attachment Preview Bar */}
        {selectedFile && (
          <div className="mb-2 p-2 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-2.5 truncate">
              {filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt="Preview"
                  className="w-10 h-10 rounded-lg object-cover border border-brand-300 dark:border-brand-800"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-300">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="truncate">
                <p className="font-semibold text-slate-900 dark:text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {(selectedFile.size / 1024).toFixed(0)} KB • Ready to send
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Interactive Emoji Picker Popover for Composer */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full mb-3 left-2 sm:left-4 w-[calc(100%-1rem)] sm:w-80 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 shadow-modal p-3 z-30 animate-fade-in"
          >
            {/* Category Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-750 pb-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {EMOJI_CATEGORIES[selectedCategoryIndex].name}
              </span>
              <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategoryIndex(idx)}
                    title={cat.name}
                    className={`px-2 py-1 rounded-md text-xs transition cursor-pointer flex items-center justify-center ${
                      selectedCategoryIndex === idx
                        ? 'bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-300 font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat.emojis[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-0.5">
              {EMOJI_CATEGORIES[selectedCategoryIndex].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  title={`Insert ${emoji}`}
                  className="p-1.5 text-base rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition transform hover:scale-125 cursor-pointer text-center flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Bottom Controls: Tap to insert or Send as Message */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-dark-750 text-[11px] text-slate-400 select-none">
              <span>Click any emoji to type into chat message</span>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Input Composer Field & Send Controls (The Nexora Command Capsule) */}
        <form onSubmit={handleSubmit} className="nx-composer-capsule p-1.5 sm:p-2 flex items-end gap-1 sm:gap-1.5">
          {/* File Input (Hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or media"
            className="p-2 rounded-xl text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 hover:bg-slate-100/80 dark:hover:bg-dark-800 transition cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Picker Trigger */}
          <button
            type="button"
            data-emoji-trigger="composer"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            title={showEmojiPicker ? "Close emoji panel" : "Open emoji panel"}
            className={`p-2 rounded-xl transition cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center ${
              showEmojiPicker
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
                : 'text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100/80 dark:hover:bg-dark-800'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Auto-growing Textarea Input */}
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={`Send message to #${conversation?.name || 'chat'}...`}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="w-full px-2 sm:px-3 py-2 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none transition resize-none leading-relaxed min-h-[40px] max-h-[140px]"
            />
          </div>

          {/* Send Button with Hover Glow & Animation */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isSending}
            className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 text-white shrink-0 shadow-md shadow-brand-600/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:scale-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      {/* Fullscreen Image Lightbox Modal */}
      <ImageLightboxModal
        file={activeLightboxFile}
        isOpen={Boolean(activeLightboxFile)}
        onClose={() => setActiveLightboxFile(null)}
      />

      {/* Modern Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          const action = confirmModal.onConfirm;
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          if (action) action();
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        type={confirmModal.type || 'danger'}
      />
    </div>
  );
};

export default RealtimeChatInterface;
