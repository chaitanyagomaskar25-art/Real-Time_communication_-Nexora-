import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  Send,
  X,
  MessageSquare,
  Search,
  Smile,
  Reply,
  Edit2,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  Lock,
  ChevronDown,
  RotateCcw,
  Paperclip,
  MoreVertical
} from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { EMOJI_CATEGORIES } from '../../utils/constants';
import ChatAttachment, { ImageLightboxModal } from './ChatAttachment';

export const getDateSeparator = (dateString) => {
  if (!dateString) return 'Today';
  const date = new Date(dateString);
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
      month: 'short',
      day: 'numeric',
      year: messageDay.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};

const ChatPanel = ({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  onTyping,
  onLoadOlderMessages,
  hasMoreMessages = false,
  isLoadingOlder = false,
  currentUserId,
  currentUserName,
  participants = [], // Array of [socketId, peer]
  typingUsers = [] // Array of { userId, userName, isPrivate }
}) => {
  const [inputText, setInputText] = useState('');
  const [recipient, setRecipient] = useState('everyone'); // 'everyone' | { socketId, userId, userName }
  const [replyingTo, setReplyingTo] = useState(null); // { messageId, senderName, content }
  const [editingMessage, setEditingMessage] = useState(null); // { messageId, content }
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'direct'
  const [activeLightboxFile, setActiveLightboxFile] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const optionsMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
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
        // Fallback
      }
    }
  }, []);

  const initialPanelScrollDoneRef = useRef(false);

  // When panel opens or room chat loads, scroll directly to the end of the chat
  useLayoutEffect(() => {
    if (isOpen) {
      scrollToBottom('auto');
      const raf = requestAnimationFrame(() => scrollToBottom('auto'));
      const t1 = setTimeout(() => scrollToBottom('auto'), 50);
      const t2 = setTimeout(() => scrollToBottom('auto'), 150);
      const t3 = setTimeout(() => scrollToBottom('auto'), 300);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      initialPanelScrollDoneRef.current = false;
    }
  }, [isOpen, scrollToBottom]);

  // When new messages arrive
  useEffect(() => {
    if (!isOpen || editingMessage) return;
    const container = chatContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 260;
    const lastMsg = messages[messages.length - 1];
    const isMyMessage = lastMsg && (lastMsg.senderId === currentUserId || lastMsg.isOwn);

    if (isNearBottom || isMyMessage || messages.length <= 2) {
      scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
    }
  }, [messages.length, isOpen, typingUsers.length, editingMessage, selectedFile, currentUserId, scrollToBottom]);

  // Re-scroll when attachments/images finish loading
  useEffect(() => {
    const handleAttachmentLoaded = () => {
      const container = chatContainerRef.current;
      if (container && isOpen) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        if (isNearBottom) {
          scrollToBottom('auto');
        }
      }
    };
    window.addEventListener('nx-chat-attachment-loaded', handleAttachmentLoaded);
    return () => window.removeEventListener('nx-chat-attachment-loaded', handleAttachmentLoaded);
  }, [isOpen, scrollToBottom]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Close options menu & emoji picker on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !e.target.closest('[data-emoji-trigger="chatpanel-composer"]')
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    if (onTyping) {
      const isPrivate = recipient !== 'everyone';
      const targetSocketId = isPrivate ? recipient.socketId : null;

      onTyping(true, targetSocketId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false, targetSocketId);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    // Enter sends message, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed && !selectedFile) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (onTyping) {
      const isPrivate = recipient !== 'everyone';
      onTyping(false, isPrivate ? recipient.socketId : null);
    }

    if (editingMessage) {
      if (onEditMessage) {
        onEditMessage(editingMessage.messageId, trimmed);
      }
      setEditingMessage(null);
      setInputText('');
      return;
    }

    const isPrivate = recipient !== 'everyone';
    const payload = {
      content: trimmed,
      file: selectedFile,
      isPrivate,
      recipientSocketId: isPrivate ? recipient.socketId : null,
      recipientUserId: isPrivate ? recipient.userId : null,
      recipientName: isPrivate ? recipient.userName : null,
      replyTo: replyingTo
    };

    onSendMessage(payload);
    setInputText('');
    setSelectedFile(null);
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleStartEdit = (msg) => {
    setEditingMessage({
      messageId: msg.id || msg._id,
      content: msg.content
    });
    setInputText(msg.content);
    setReplyingTo(null);
    textareaRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleCopyText = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter messages by search and active tab
  const filteredMessages = messages.filter((m) => {
    if (activeTab === 'direct' && !m.isPrivate) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const contentMatch = m.content?.toLowerCase().includes(q);
      const senderMatch = m.senderName?.toLowerCase().includes(q);
      return contentMatch || senderMatch;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 bottom-24 w-full sm:w-90 md:w-98 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-slate-800 z-30 flex flex-col shadow-2xl transition-all duration-300 select-text">
      {/* 1. CHAT HEADER */}
      <div className="px-4 py-3 bg-white dark:bg-dark-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-subtle">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Meeting Chat
            </h3>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{participants.length + 1} online in call</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Search Action */}
          <button
            onClick={() => {
              setShowSearch((prev) => !prev);
              if (showSearch) setSearchQuery('');
            }}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              showSearch
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Search Messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* More Options */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="More Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-modal p-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    setActiveTab(activeTab === 'all' ? 'direct' : 'all');
                    setShowOptionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{activeTab === 'all' ? 'Filter Direct Messages' : 'Show All Messages'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-dark-950 flex items-center gap-2 animate-fade-in">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by text or sender..."
            autoFocus
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Tab Filter: All vs Direct */}
      <div className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-dark-950 flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 rounded-lg font-semibold transition ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          All Messages
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
            activeTab === 'direct'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span>Direct Messages</span>
        </button>
      </div>

      {/* 2. MESSAGE AREA */}
      <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {/* Pagination */}
        {hasMoreMessages && (
          <div className="text-center pb-2">
            <button
              onClick={onLoadOlderMessages}
              disabled={isLoadingOlder}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 transition flex items-center gap-1.5 mx-auto"
            >
              <RotateCcw className={`w-3 h-3 ${isLoadingOlder ? 'animate-spin' : ''}`} />
              <span>{isLoadingOlder ? 'Loading...' : 'Load older messages'}</span>
            </button>
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 opacity-40 text-brand-500" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {searchQuery ? 'No messages match your search' : 'No messages yet'}
            </p>
            <p className="text-[11px] text-slate-400">
              Exchange instant messages and collaborate with your team!
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const messageId = msg.id || msg._id || `msg_${index}`;
            const isOwn = msg.senderId === currentUserId;
            const isSystem = Boolean(
              msg.messageType === 'system' ||
              msg.isSystem ||
              msg.senderId === 'system' ||
              msg.senderName === 'System' ||
              (typeof msg.content === 'string' && (
                msg.content.startsWith('📞') ||
                msg.content.includes('Started a voice call') ||
                msg.content.includes('Started a video call') ||
                msg.content.startsWith('User joined') ||
                msg.content.startsWith('User left')
              ))
            );

            // System Message
            if (isSystem) {
              return (
                <div key={messageId} className="flex justify-center my-2">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full shadow-subtle border border-slate-200/60 dark:border-slate-750">
                    {msg.content}
                  </span>
                </div>
              );
            }

            // Date separator calculation
            const prevMsg = filteredMessages[index - 1];
            const currentDateLabel = getDateSeparator(msg.createdAt || msg.timestamp);
            const prevDateLabel = prevMsg ? getDateSeparator(prevMsg.createdAt || prevMsg.timestamp) : null;
            const showDateSeparator = index === 0 || currentDateLabel !== prevDateLabel;

            const timeString = formatTime(msg.timestamp);

            return (
              <React.Fragment key={messageId}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-3">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 max-w-[60px]" />
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-2 shadow-subtle">
                      {currentDateLabel}
                    </span>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 max-w-[60px]" />
                  </div>
                )}

                <div
                  className={`relative group flex items-end gap-2 ${
                    isOwn ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar for incoming */}
                  {!isOwn && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center shrink-0 mb-0.5 shadow-subtle">
                      {msg.senderName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    {/* Sender & Timestamp */}
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isOwn ? 'You' : msg.senderName}
                      </span>
                      <span>•</span>
                      <span>{timeString}</span>
                      {msg.isPrivate && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 rounded font-medium">
                          <Lock className="w-2.5 h-2.5" />
                          Direct
                        </span>
                      )}
                      {msg.isEdited && (
                        <span className="text-[9px] text-slate-400 italic">(edited)</span>
                      )}
                    </div>

                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div
                        className={`text-[11px] px-2.5 py-1 mb-1 rounded-xl border-l-2 max-w-full truncate ${
                          isOwn
                            ? 'bg-brand-900/30 text-brand-200 border-brand-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-500'
                        }`}
                      >
                        <span className="font-semibold block">{msg.replyTo.senderName}:</span>
                        <span className="truncate block opacity-85">{msg.replyTo.content}</span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`relative px-3.5 py-2 rounded-2xl text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed shadow-subtle transition ${
                        msg.isDeleted
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 italic'
                          : isOwn
                          ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 rounded-bl-xs'
                      }`}
                    >
                      {/* File / Media Attachment Display */}
                      {msg.file && (
                        <ChatAttachment
                          file={msg.file}
                          isMe={isOwn}
                          onOpenLightbox={(f) => setActiveLightboxFile(f)}
                        />
                      )}

                      {/* Text Content (suppress redundant [Attachment: ...] label when media is present) */}
                      {msg.content && (!msg.file || (!msg.content.startsWith('[Attachment:') && !msg.content.startsWith('Attachment:'))) && (
                        <p>{msg.content}</p>
                      )}

                      {/* Status Checkmarks */}
                      {isOwn && !msg.isDeleted && (
                        <div className="flex justify-end mt-0.5 text-brand-200 text-[10px]">
                          {msg.status === 'delivered' ? (
                            <CheckCheck className="w-3 h-3 opacity-90" />
                          ) : (
                            <Check className="w-3 h-3 opacity-70" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.reactions.map((react, i) => {
                          const hasReacted = react.users?.some((u) => u.userId === currentUserId);
                          return (
                            <button
                              key={i}
                              onClick={() => onReaction && onReaction(messageId, react.emoji)}
                              className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border transition shadow-subtle ${
                                hasReacted
                                  ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300'
                                  : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>{react.emoji}</span>
                              <span className="text-[10px] font-bold">{react.users?.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hover Actions */}
                  {!msg.isDeleted && (
                    <div
                      className={`absolute -top-3.5 ${
                        isOwn ? 'right-2' : 'left-8'
                      } hidden group-hover:flex items-center gap-1 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded-xl shadow-elevated z-20 text-slate-400`}
                    >
                      <button
                        onClick={() => onReaction && onReaction(messageId, '👍')}
                        className="p-1 hover:scale-125 transition text-xs"
                        title="React 👍"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => onReaction && onReaction(messageId, '❤️')}
                        className="p-1 hover:scale-125 transition text-xs"
                        title="React ❤️"
                      >
                        ❤️
                      </button>
                      <button
                        onClick={() =>
                          setReplyingTo({
                            messageId,
                            senderName: msg.senderName,
                            content: msg.content
                          })
                        }
                        className="p-1 hover:text-slate-800 dark:hover:text-white rounded"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopyText(msg.content, messageId)}
                        className="p-1 hover:text-slate-800 dark:hover:text-white rounded"
                        title="Copy"
                      >
                        {copiedId === messageId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isOwn && onEditMessage && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1 hover:text-slate-800 dark:hover:text-white rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isOwn && onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(messageId)}
                          className="p-1 hover:text-rose-500 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Animated Bouncing Typing Dots */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-1 animate-fade-in">
            <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" />
            </div>
            <span className="text-[11px] italic text-slate-400">
              {typingUsers.map((u) => u.userName).join(', ')}{' '}
              {typingUsers.length > 1 ? 'are' : 'is'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
          <div className="truncate">
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              Replying to {replyingTo.senderName}:
            </span>
            <span className="ml-1.5 text-slate-400 truncate">{replyingTo.content}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="px-3.5 py-1.5 bg-brand-50 dark:bg-brand-950/60 border-t border-brand-200 dark:border-brand-900 flex items-center justify-between text-xs text-brand-700 dark:text-brand-300">
          <span>Editing your message</span>
          <button
            onClick={handleCancelEdit}
            className="text-[11px] underline text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Attached file preview chip */}
      {selectedFile && (
        <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-3.5 h-3.5 text-brand-600" />
            <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
              {selectedFile.name}
            </span>
            <span className="text-[10px] text-slate-400">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-0.5 text-slate-400 hover:text-rose-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Emoji Panel */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="mx-3 mb-2 p-3 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-modal z-20 animate-fade-in"
        >
          {/* Category Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 select-none">
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
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  textareaRef.current?.focus();
                }}
                title={`Insert ${emoji}`}
                className="p-1.5 text-base rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition transform hover:scale-125 cursor-pointer text-center flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 select-none">
            <span>Click any emoji to insert into chat message</span>
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

      {/* 3. MESSAGE COMPOSER */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-dark-900 space-y-2 shrink-0">
        {/* Hidden File Picker */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Recipient Selector (To: Everyone vs Direct Participant) */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold text-[10px]">To:</span>
          <div className="relative flex-1">
            <select
              value={recipient === 'everyone' ? 'everyone' : recipient.socketId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'everyone') {
                  setRecipient('everyone');
                } else {
                  const targetPeer = participants.find(([socketId]) => socketId === val);
                  if (targetPeer) {
                    setRecipient({
                      socketId: targetPeer[0],
                      userId: targetPeer[1].userId || targetPeer[0],
                      userName: targetPeer[1].userName || 'Participant'
                    });
                  }
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
            >
              <option value="everyone">Everyone (Public Meeting)</option>
              {participants.map(([socketId, peer]) => (
                <option key={socketId} value={socketId}>
                  🔒 Direct: {peer.userName || 'Participant'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Modern Rounded Message Input & Action Buttons */}
        <div className="flex items-end gap-1.5">
          <div className="flex items-center gap-0.5 pb-1 text-slate-400">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-emoji-trigger="chatpanel-composer"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                showEmojiPicker
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60'
                  : 'hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={showEmojiPicker ? "Close emoji panel" : "Open emoji panel"}
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 relative rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500 transition">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessage
                  ? 'Update your message...'
                  : recipient === 'everyone'
                  ? 'Message everyone... (Enter to send)'
                  : `Direct to ${recipient.userName}...`
              }
              className="w-full bg-transparent px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none leading-relaxed max-h-[120px]"
            />
          </div>

          <div className="pb-1">
            <button
              type="submit"
              disabled={!inputText.trim() && !selectedFile}
              className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition cursor-pointer"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* Fullscreen Image Lightbox Modal */}
      <ImageLightboxModal
        file={activeLightboxFile}
        isOpen={Boolean(activeLightboxFile)}
        onClose={() => setActiveLightboxFile(null)}
      />
    </div>
  );
};

export default ChatPanel;
