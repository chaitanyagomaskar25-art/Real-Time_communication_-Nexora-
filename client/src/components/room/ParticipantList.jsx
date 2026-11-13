import React, { useState, useMemo } from 'react';
import {
  Users,
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Crown,
  Check,
  UserX,
  Lock,
  Unlock,
  ScreenShare,
  ScreenShareOff,
  Search,
  Hand,
  Settings,
  MoreVertical,
  Edit2,
  CheckCheck
} from 'lucide-react';
import { getInitials } from '../../utils/formatters';
import Button from '../common/Button';

const ParticipantList = ({
  isOpen,
  onClose,
  participants = [],
  currentUserName = 'You',
  isAudioMuted = false,
  isVideoOff = false,
  isHost = false,
  isCoHost = false,
  isHandRaised = false,
  waitingList = [],
  onAdmit,
  onReject,
  isMeetingLocked = false,
  onToggleLock,
  presenter = null,
  onHostStopScreenShare,
  roomPermissions = {},
  onUpdateRoomPermissions,
  onMuteParticipant,
  onDisableVideo,
  onRemoveParticipant,
  onPromoteCoHost,
  onRevokeCoHost,
  onLowerParticipantHand,
  onLowerAllHands,
  onChangeDisplayName
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'hands' | 'waiting' | 'permissions'
  const [activeMenuSocketId, setActiveMenuSocketId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUserName);

  const canManage = isHost || isCoHost;

  // Filter & sort participants (chronological queue order when hands are raised)
  const filteredParticipants = useMemo(() => {
    const list = participants.filter(([, peer]) => {
      const name = peer.userName || 'Guest';
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;

      if (activeTab === 'hands') {
        return Boolean(peer.isHandRaised);
      }
      return true;
    });

    if (activeTab === 'hands') {
      return list.sort((a, b) => {
        const timeA = a[1].handRaisedAt ? new Date(a[1].handRaisedAt).getTime() : 0;
        const timeB = b[1].handRaisedAt ? new Date(b[1].handRaisedAt).getTime() : 0;
        return timeA - timeB;
      });
    }

    return list;
  }, [participants, searchQuery, activeTab]);

  const raisedHandsCount = useMemo(() => {
    let count = isHandRaised ? 1 : 0;
    participants.forEach(([, peer]) => {
      if (peer.isHandRaised) count += 1;
    });
    return count;
  }, [participants, isHandRaised]);

  const handleNameSave = (e) => {
    e.preventDefault();
    if (nameInput.trim() && onChangeDisplayName) {
      onChangeDisplayName(nameInput.trim());
    }
    setIsEditingName(false);
  };

  const handlePermissionToggle = (key) => {
    if (!canManage || !onUpdateRoomPermissions) return;
    const currentVal = roomPermissions[key] !== false;
    onUpdateRoomPermissions({
      ...roomPermissions,
      [key]: !currentVal
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 bottom-24 w-full sm:w-84 md:w-96 bg-dark-900/95 backdrop-blur-xl border-l border-slate-800 z-30 flex flex-col shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Users className="w-4 h-4 text-brand-400" />
          <span>Participants ({1 + participants.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-2 pt-2 border-b border-slate-800 bg-dark-950/40 text-xs shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'all'
              ? 'border-brand-500 text-brand-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>All</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {1 + participants.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('hands')}
          className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'hands'
              ? 'border-amber-500 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hand className="w-3.5 h-3.5 text-amber-400" />
          <span>Hands</span>
          {raisedHandsCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold">
              {raisedHandsCount}
            </span>
          )}
        </button>

        {canManage && waitingList.length > 0 && (
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'waiting'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Waiting</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
              {waitingList.length}
            </span>
          </button>
        )}

        {canManage && (
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ml-auto ${
              activeTab === 'permissions'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            title="Meeting Settings & Permissions"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Controls</span>
          </button>
        )}
      </div>

      {/* Search Input (visible on 'all' and 'hands') */}
      {activeTab !== 'permissions' && activeTab !== 'waiting' && (
        <div className="p-3 border-b border-slate-800/80 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/60 text-xs text-slate-200 pl-8 pr-3 py-2 rounded-xl border border-slate-700/60 focus:outline-none focus:border-brand-500 placeholder-slate-500 transition"
            />
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* TAB 1: Host Controls / Room Permissions */}
        {activeTab === 'permissions' && canManage && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-slate-200 flex items-center justify-between">
                <span>Room Security</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {isMeetingLocked ? 'Locked' : 'Open'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-slate-400">Lock Meeting (Prevent new joins)</span>
                <Button
                  size="sm"
                  variant={isMeetingLocked ? 'secondary' : 'outline'}
                  onClick={onToggleLock}
                  className="text-[11px] py-1 px-2.5"
                >
                  {isMeetingLocked ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                  {isMeetingLocked ? 'Unlock Room' : 'Lock Room'}
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-slate-200">Quick Room Actions</div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLowerAllHands}
                  className="text-[11px] py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5"
                >
                  <Hand className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lower All Hands</span>
                </Button>
              </div>
            </div>

            {/* Participant Permissions */}
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
              <div className="font-semibold text-slate-200">Participant Privileges</div>
              <p className="text-[11px] text-slate-400">Controls what non-host participants can do in this meeting:</p>

              {/* Allow Unmute */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800">
                <span className="text-slate-300">Allow participants to unmute microphone</span>
                <input
                  type="checkbox"
                  checked={roomPermissions.allowParticipantUnmute !== false}
                  onChange={() => handlePermissionToggle('allowParticipantUnmute')}
                  className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
                />
              </div>

              {/* Allow Video */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800">
                <span className="text-slate-300">Allow participants to turn on camera</span>
                <input
                  type="checkbox"
                  checked={roomPermissions.allowParticipantVideo !== false}
                  onChange={() => handlePermissionToggle('allowParticipantVideo')}
                  className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
                />
              </div>

              {/* Allow Screen Share */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800">
                <span className="text-slate-300">Allow participants to share screen</span>
                <input
                  type="checkbox"
                  checked={roomPermissions.allowScreenShare !== false}
                  onChange={() => handlePermissionToggle('allowScreenShare')}
                  className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
                />
              </div>

              {/* Allow Whiteboard */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800">
                <span className="text-slate-300">Allow participants to draw on whiteboard</span>
                <input
                  type="checkbox"
                  checked={roomPermissions.allowParticipantWhiteboard !== false}
                  onChange={() => handlePermissionToggle('allowParticipantWhiteboard')}
                  className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
                />
              </div>

              {/* Allow Name Change */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800">
                <span className="text-slate-300">Allow participants to rename themselves</span>
                <input
                  type="checkbox"
                  checked={roomPermissions.allowNameChange !== false}
                  onChange={() => handlePermissionToggle('allowNameChange')}
                  className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Waiting Room Queue */}
        {(activeTab === 'waiting' || (canManage && waitingList.length > 0 && activeTab === 'all')) && waitingList.length > 0 && (
          <div className="space-y-2 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Waiting Room ({waitingList.length})
              </span>
            </div>

            <div className="space-y-2">
              {waitingList.map((peer) => (
                <div
                  key={peer.socketId}
                  className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">{peer.userName}</p>
                    <p className="text-[10px] text-slate-400">Waiting for admission...</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAdmit && onAdmit(peer.socketId)}
                      title="Admit to Meeting"
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onReject && onReject(peer.socketId)}
                      title="Decline Request"
                      className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Main Participant List (All / Raised Hands) */}
        {activeTab !== 'permissions' && (
          <div className="space-y-2">
            {activeTab === 'hands' && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Hand className="w-3.5 h-3.5" />
                  <span>Queue Order ({raisedHandsCount})</span>
                </span>
                {canManage && raisedHandsCount > 0 && (
                  <button
                    onClick={onLowerAllHands}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Lower All Hands
                  </button>
                )}
              </div>
            )}

            {/* Local User ("You") Card */}
            {(activeTab === 'all' || (activeTab === 'hands' && isHandRaised)) && (
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {getInitials(currentUserName)}
                    </div>
                    <div className="truncate">
                      {isEditingName ? (
                        <form onSubmit={handleNameSave} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className="bg-slate-900 text-xs px-2 py-0.5 rounded border border-brand-500 text-white focus:outline-none"
                            autoFocus
                          />
                          <button type="submit" className="p-1 text-brand-400 hover:text-brand-300 cursor-pointer">
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingName(false)}
                            className="p-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate">{currentUserName}</span>
                          <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1 rounded font-bold">You</span>
                          {(roomPermissions.allowNameChange !== false || canManage) && (
                            <button
                              onClick={() => {
                                setNameInput(currentUserName);
                                setIsEditingName(true);
                              }}
                              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                              title="Rename Yourself"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        {isHost ? (
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            <Crown className="w-3 h-3" /> Host
                          </span>
                        ) : isCoHost ? (
                          <span className="text-indigo-400 font-bold flex items-center gap-0.5">
                            <Shield className="w-3 h-3" /> Co-Host
                          </span>
                        ) : (
                          <span>Participant</span>
                        )}

                        {isHandRaised && (
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            • ✋ Hand Raised
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                    {presenter && presenter.socketId === 'local' && (
                      <span className="flex items-center gap-1 text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-1.5 py-0.5 rounded">
                        <ScreenShare className="w-3 h-3 text-brand-400" />
                        Sharing
                      </span>
                    )}
                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-slate-400" />}
                    {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </div>
              </div>
            )}

            {/* Remote Participants */}
            {filteredParticipants.map(([socketId, peer]) => {
              const isPresenting = presenter && presenter.socketId === socketId;
              const peerRole = peer.role || (peer.isCoHost ? 'co-host' : 'participant');
              const isPeerHost = peerRole === 'host';
              const isPeerCoHost = peerRole === 'co-host';
              const showMenu = activeMenuSocketId === socketId;

              return (
                <div
                  key={socketId}
                  className="relative p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {getInitials(peer.userName || 'Guest')}
                      </div>

                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{peer.userName || 'Guest'}</span>
                          {peer.isHandRaised && (
                            <span className="text-amber-400 text-xs animate-bounce" title="Hand Raised">
                              ✋
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          {isPeerHost ? (
                            <span className="text-amber-400 font-bold flex items-center gap-0.5">
                              <Crown className="w-3 h-3" /> Host
                            </span>
                          ) : isPeerCoHost ? (
                            <span className="text-indigo-400 font-bold flex items-center gap-0.5">
                              <Shield className="w-3 h-3" /> Co-Host
                            </span>
                          ) : (
                            <span>Participant</span>
                          )}

                          {isPresenting && (
                            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                              • Presenting
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 shrink-0">
                      {isPresenting && canManage && onHostStopScreenShare && (
                        <button
                          onClick={() => onHostStopScreenShare(socketId)}
                          className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition cursor-pointer"
                          title="Stop participant's screen share"
                        >
                          <ScreenShareOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!peer.audio ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-slate-400" />}
                      {!peer.video ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-slate-400" />}

                      {/* Admin Management Dropdown Trigger */}
                      {canManage && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuSocketId(showMenu ? null : socketId)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition cursor-pointer"
                            title="Manage Participant"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {showMenu && (
                            <div className="absolute right-0 bottom-6 sm:bottom-auto sm:top-6 w-48 p-1.5 bg-dark-900 border border-slate-700 rounded-xl shadow-2xl z-50 text-xs space-y-1">
                              {/* Mute Audio */}
                              {peer.audio && (
                                <button
                                  onClick={() => {
                                    if (onMuteParticipant) onMuteParticipant(socketId);
                                    setActiveMenuSocketId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Mute Participant</span>
                                </button>
                              )}

                              {/* Disable Camera */}
                              {peer.video && (
                                <button
                                  onClick={() => {
                                    if (onDisableVideo) onDisableVideo(socketId);
                                    setActiveMenuSocketId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                  <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Turn Off Camera</span>
                                </button>
                              )}

                              {/* Lower Hand */}
                              {peer.isHandRaised && (
                                <button
                                  onClick={() => {
                                    if (onLowerParticipantHand) onLowerParticipantHand(socketId);
                                    setActiveMenuSocketId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-amber-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                  <Hand className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Lower Hand</span>
                                </button>
                              )}

                              {/* Promote / Revoke Co-Host (Main Host Only) */}
                              {isHost && !isPeerHost && (
                                <>
                                  {isPeerCoHost ? (
                                    <button
                                      onClick={() => {
                                        if (onRevokeCoHost) onRevokeCoHost(socketId);
                                        setActiveMenuSocketId(null);
                                      }}
                                      className="w-full text-left px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Revoke Co-Host</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (onPromoteCoHost) onPromoteCoHost(socketId);
                                        setActiveMenuSocketId(null);
                                      }}
                                      className="w-full text-left px-2 py-1.5 rounded-lg text-indigo-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>Make Co-Host</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Remove Participant (Host can remove anyone except self; Co-host can remove non-hosts) */}
                              {(!isPeerHost && (!isPeerCoHost || isHost)) && (
                                <button
                                  onClick={() => {
                                    if (onRemoveParticipant) onRemoveParticipant(socketId, 'Removed by meeting host');
                                    setActiveMenuSocketId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Remove Participant</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredParticipants.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                {activeTab === 'hands' ? 'No hands raised' : 'No participants found'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantList;
