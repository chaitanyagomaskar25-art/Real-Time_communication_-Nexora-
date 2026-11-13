import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  UsersRound,
  X,
  Star,
  Pin,
  BellOff,
  Bell,
  MessageSquare,
  Sparkles,
  CheckCheck,
  Check,
  MoreVertical,
  Trash2
} from 'lucide-react';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import ConfirmDialog from '../common/ConfirmDialog';
import { ConversationSkeleton } from '../common/Skeleton';
import StatusDot from '../common/StatusDot';

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Now';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return timestamp;
  }
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24 && now.toDateString() === date.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ConversationPanel = ({
  conversations = [],
  selectedId = null,
  onSelectConversation,
  onOpenNewConversation,
  onDeleteGroup,
  isLoading = false,
  initialTab = 'all',
  onToggleFavorite,
  onTogglePin,
  onToggleMute
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab); // 'all' | 'unread' | 'groups' | 'favorites'
  const [groupToDelete, setGroupToDelete] = useState(null);

  // Persist pinned and muted states in localStorage (defaults to empty: nothing is pinned by default)
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_pinned_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Remove legacy hardcoded 'group-general' so nothing is pinned without user action
          const cleaned = parsed.filter((id) => id !== 'group-general');
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexora_pinned_conversations', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [mutedIds, setMutedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_muted_conversations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_favorite_conversations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync tab if initialTab prop changes
  useEffect(() => {
    if (initialTab && ['all', 'unread', 'groups', 'favorites'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTogglePinAction = (e, convId) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId];
      try {
        localStorage.setItem('nexora_pinned_conversations', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (onTogglePin) onTogglePin(convId);
  };

  const handleToggleMuteAction = (e, convId) => {
    e.stopPropagation();
    setMutedIds((prev) => {
      const next = prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId];
      try {
        localStorage.setItem('nexora_muted_conversations', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (onToggleMute) onToggleMute(convId);
  };

  const handleToggleFavAction = (e, convId) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId];
      try {
        localStorage.setItem('nexora_favorite_conversations', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (onToggleFavorite) onToggleFavorite(convId);
  };

  // Filter & sort conversations (pinned conversations float to top)
  const processedConversations = useMemo(() => {
    const list = conversations.filter((c) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchLastMsg = c.lastMessage?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        if (!matchName && !matchLastMsg && !matchEmail) return false;
      }

      // Tab filter
      if (activeTab === 'unread') {
        return (c.unreadCount || 0) > 0;
      }
      if (activeTab === 'groups') {
        return Boolean(c.isGroup);
      }
      if (activeTab === 'favorites') {
        return favoriteIds.includes(c.id) || Boolean(c.isFavorite) || pinnedIds.includes(c.id);
      }
      return true;
    });

    // Sort: Pinned first, then by recency / original order
    return list.sort((a, b) => {
      const isAPinned = pinnedIds.includes(a.id) || a.isPinned;
      const isBPinned = pinnedIds.includes(b.id) || b.isPinned;
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return 0;
    });
  }, [conversations, searchQuery, activeTab, pinnedIds, favoriteIds]);

  const totalUnreadCount = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
  const totalGroupsCount = conversations.filter((c) => c.isGroup).length;
  const totalFavCount = conversations.filter(
    (c) => favoriteIds.includes(c.id) || c.isFavorite || pinnedIds.includes(c.id)
  ).length;

  return (
    <aside className="w-full h-full bg-white dark:bg-dark-900 flex flex-col shrink-0 select-none overflow-hidden min-h-0">
      {/* Top Heading & Actions */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-dark-750 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold shadow-subtle">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 font-heading">
              Messages
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300">
                {conversations.length}
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">Direct & Channel Communications</p>
          </div>
        </div>

        <button
          onClick={onOpenNewConversation}
          title="Start New Conversation"
          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm shadow-brand-600/20 cursor-pointer transition transform active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Modern Search Field */}
      <div className="px-3.5 pt-3 pb-2 shrink-0">
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder="Search messages, channels, peers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition shadow-subtle"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs: All, Unread, Groups, Favorites/Pinned */}
      <div className="px-3 py-1 flex items-center gap-1 border-b border-slate-100 dark:border-dark-750 pb-2.5 shrink-0">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition text-center ${
            activeTab === 'all'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800'
          }`}
        >
          All
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            activeTab === 'unread'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800'
          }`}
        >
          <span>Unread</span>
          {totalUnreadCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
              {totalUnreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            activeTab === 'groups'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800'
          }`}
        >
          <span>Groups</span>
          {totalGroupsCount > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              ({totalGroupsCount})
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            activeTab === 'favorites'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-subtle'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800'
          }`}
        >
          <span>Pinned</span>
          {totalFavCount > 0 && (
            <span className="text-[10px] text-amber-500 font-medium">
              ({totalFavCount})
            </span>
          )}
        </button>
      </div>

      {/* Conversation List Stream (Scoped scrolling container) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1 overscroll-contain">
        {isLoading ? (
          <ConversationSkeleton count={5} />
        ) : processedConversations.length === 0 ? (
          /* Custom NEXORA Empty State */
          <EmptyState
            illustration={searchQuery ? 'search' : 'messages'}
            title={
              searchQuery
                ? 'No matching results'
                : activeTab === 'unread'
                ? 'Zero unread messages'
                : activeTab === 'groups'
                ? 'No group channels found'
                : activeTab === 'favorites'
                ? 'No pinned conversations'
                : 'Start your first conversation'
            }
            description={
              searchQuery
                ? `No conversations matched "${searchQuery}". Try a different name or channel.`
                : activeTab === 'unread'
                ? 'All conversations are caught up! Enjoy your clean inbox.'
                : activeTab === 'favorites'
                ? 'Pin any conversation to keep it pinned at the top.'
                : 'Collaborate in real-time with team peers and group conferences.'
            }
            action={
              searchQuery || activeTab !== 'all' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTab('all');
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={onOpenNewConversation}
                  className="text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Start Chat
                </Button>
              )
            }
          />
        ) : (
          processedConversations.map((conv) => {
            const isSelected = selectedId === conv.id;
            const hasUnread = (conv.unreadCount || 0) > 0;
            const isPinned = pinnedIds.includes(conv.id) || Boolean(conv.isPinned);
            const isMuted = mutedIds.includes(conv.id) || Boolean(conv.isMuted);
            const isFav = favoriteIds.includes(conv.id) || Boolean(conv.isFavorite);

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`group relative p-3 rounded-2xl cursor-pointer transition-all duration-200 flex items-start gap-3 border ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-50/95 via-violet-50/60 to-white/90 dark:from-brand-950/70 dark:via-dark-900 dark:to-dark-850 border-brand-300/90 dark:border-brand-500/50 shadow-elevated text-slate-900 dark:text-white'
                    : 'bg-transparent border-transparent hover:bg-slate-100/70 dark:hover:bg-dark-850/70 text-slate-700 dark:text-slate-300 hover:border-slate-200/60 dark:hover:border-dark-750'
                }`}
              >
                {/* Active Indicator Blade on Left Edge */}
                {isSelected && <span className="nx-active-blade" />}

                {/* High-quality Avatar presentation with Orbital ring */}
                <div className={`relative shrink-0 mt-0.5 ${isSelected ? 'nx-orbital-aura' : ''}`}>
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-200 ${
                      conv.isGroup
                        ? 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 text-white'
                        : isSelected
                        ? 'bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 text-white shadow-glow ring-2 ring-brand-400/40'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-dark-750'
                    }`}
                  >
                    {conv.isGroup ? (
                      <UsersRound className="w-4 h-4 text-white" />
                    ) : (
                      conv.avatarText || conv.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>

                  {/* Animated Online / Offline Status Indicator */}
                  {!conv.isGroup && (
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot
                        status={conv.isOnline ? 'available' : conv.status || 'offline'}
                        size="sm"
                      />
                    </div>
                  )}
                </div>

                {/* Card Content: Name, Relative Timestamp, Last Message Preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`text-xs truncate ${
                          hasUnread || isSelected
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {conv.name}
                      </span>
                      {isPinned && (
                        <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 transform -rotate-45" title="Pinned" />
                      )}
                      {isMuted && (
                        <BellOff className="w-3 h-3 text-slate-400 shrink-0" title="Muted" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatRelativeTime(conv.timestamp || conv.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p
                      className={`text-[11px] truncate leading-tight ${
                        hasUnread
                          ? 'font-medium text-slate-900 dark:text-slate-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {conv.lastMessage || 'Ready for real-time collaboration'}
                    </p>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Action buttons on hover: Pin, Mute */}
                      <button
                        onClick={(e) => handleTogglePinAction(e, conv.id)}
                        title={isPinned ? 'Unpin conversation' : 'Pin conversation to top'}
                        className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                          isPinned
                            ? '!opacity-100 text-amber-500'
                            : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => handleToggleMuteAction(e, conv.id)}
                        title={isMuted ? 'Unmute' : 'Mute notifications'}
                        className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                          isMuted
                            ? '!opacity-100 text-slate-400'
                            : 'text-slate-300 hover:text-slate-600 dark:text-slate-600'
                        }`}
                      >
                        <BellOff className="w-3 h-3" />
                      </button>

                      {conv.isGroup && onDeleteGroup && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(conv);
                          }}
                          title="Delete group"
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Unread Message Counter Badge */}
                      {hasUnread && (
                        <span className="px-1.5 py-0.2 min-w-[18px] text-center rounded-full bg-gradient-to-r from-brand-600 to-violet-600 text-white text-[10px] font-bold shadow-subtle">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modern Confirmation Dialog for Deleting Group */}
      <ConfirmDialog
        isOpen={Boolean(groupToDelete)}
        onClose={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete && onDeleteGroup) {
            onDeleteGroup(groupToDelete.id);
            setGroupToDelete(null);
          }
        }}
        title="Delete Group"
        description={`Are you sure you want to delete "${groupToDelete?.name || 'this group'}"? All group messages and channels will be permanently removed.`}
        confirmText="Delete Group"
        cancelText="Cancel"
        type="danger"
      />
    </aside>
  );
};

export default ConversationPanel;
