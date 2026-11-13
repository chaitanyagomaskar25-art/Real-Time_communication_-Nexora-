import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Users,
  MessageSquare,
  FolderUp,
  Palette,
  PhoneOff,
  LayoutGrid,
  Rows,
  UserCheck,
  MonitorPlay,
  Sparkles,
  Subtitles,
  Smile,
  Disc,
  SplitSquareVertical,
  ChevronUp,
  Info,
  ShieldAlert,
  Volume2,
  Hand,
  FileText,
  BarChart2,
  Lock
} from 'lucide-react';

const ControlsBar = ({
  isAudioMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleFiles,
  onToggleWhiteboard,
  onToggleInfo,
  onLeaveCall,
  onEndCallForAll,
  isChatOpen = false,
  isParticipantsOpen = false,
  isFilesOpen = false,
  isWhiteboardActive = false,
  unreadCount = 0,
  unseenFilesCount = 0,
  participantCount = 1,
  isHost = false,
  isMeetingLocked = false,
  waitingCount = 0,
  layout = 'grid',
  onChangeLayout,
  audioOutputDevices = [],
  selectedAudioOutputId = 'default',
  onSelectAudioOutput,
  isHandRaised = false,
  onToggleRaiseHand,
  onSendReaction,
  isNotesOpen = false,
  onToggleNotes,
  isPollsOpen = false,
  onTogglePolls,
  onToggleBreakout,
  isCoHost = false,
  isRecording = false,
  onToggleRecording,
  recordingDuration = 0,
  isTranscriptOpen = false,
  onToggleTranscript,
  onToggleInsights,
  isTranscribing = false
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const containerRef = useRef(null);

  // Close open floating menus on outside click or escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowReactionsMenu(false);
        setShowLayoutMenu(false);
        setShowSpeakerMenu(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowReactionsMenu(false);
        setShowLayoutMenu(false);
        setShowSpeakerMenu(false);
      }
    };

    if (showReactionsMenu || showLayoutMenu || showSpeakerMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showReactionsMenu, showLayoutMenu, showSpeakerMenu]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1rem)] px-1 flex flex-col items-center pointer-events-auto"
    >
      {/* Floating Reactions Emoji Tray (Rendered above bar so it NEVER gets clipped by overflow) */}
      {showReactionsMenu && (
        <div className="mb-2 p-2 bg-dark-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl flex items-center gap-1.5 z-50 animate-fade-in pointer-events-auto">
          {['👍', '👏', '😂', '❤️', '🎉', '🔥', '😮'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                if (onSendReaction) onSendReaction(emoji);
                setShowReactionsMenu(false);
              }}
              className="w-10 h-10 rounded-xl hover:bg-slate-800/80 flex items-center justify-center text-2xl transition-transform hover:scale-125 active:scale-95 cursor-pointer"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Floating Speaker Selection Menu */}
      {showSpeakerMenu && (
        <div className="mb-2 w-64 p-2 bg-dark-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-xl shadow-2xl space-y-1 z-50 text-xs animate-fade-in pointer-events-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Select Speaker
          </div>
          {audioOutputDevices.map((dev) => (
            <button
              key={dev.deviceId}
              onClick={() => {
                if (onSelectAudioOutput) onSelectAudioOutput(dev.deviceId);
                setShowSpeakerMenu(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                selectedAudioOutputId === dev.deviceId
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{dev.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating Video Layout Menu */}
      {showLayoutMenu && (
        <div className="mb-2 w-48 p-1.5 bg-dark-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-xl shadow-2xl space-y-1 z-50 text-xs animate-fade-in pointer-events-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
            View Layout
          </div>
          <button
            onClick={() => {
              if (onChangeLayout) onChangeLayout('grid');
              setShowLayoutMenu(false);
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition ${
              layout === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Grid View</span>
          </button>
          <button
            onClick={() => {
              if (onChangeLayout) onChangeLayout('speaker');
              setShowLayoutMenu(false);
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition ${
              layout === 'speaker' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Speaker Spotlight</span>
          </button>
          <button
            onClick={() => {
              if (onChangeLayout) onChangeLayout('gallery');
              setShowLayoutMenu(false);
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition ${
              layout === 'gallery' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Rows className="w-4 h-4" />
            <span>Gallery View</span>
          </button>
          <button
            onClick={() => {
              if (onChangeLayout) onChangeLayout('presentation');
              setShowLayoutMenu(false);
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition ${
              layout === 'presentation' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MonitorPlay className="w-4 h-4" />
            <span>Presentation View</span>
          </button>
        </div>
      )}

      {/* Main Buttons Bar (horizontal scrolling on narrow mobile viewports) */}
      <div className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-dark-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl overflow-x-auto max-w-full">
        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isAudioMuted
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Camera On/Off */}
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isVideoOff
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isScreenSharing
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen (Window, Tab, or Full Screen)'}
        >
          {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
        </button>

        {/* Speaker Output Selection Toggle */}
        {audioOutputDevices.length > 0 && (
          <button
            onClick={() => {
              setShowSpeakerMenu((prev) => !prev);
              setShowLayoutMenu(false);
              setShowReactionsMenu(false);
            }}
            className={`p-3 rounded-xl transition cursor-pointer ${
              showSpeakerMenu ? 'bg-brand-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title="Speaker Audio Output"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        )}

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Video Layout Switcher (Grid, Speaker, Gallery, Presentation) */}
        <button
          onClick={() => {
            setShowLayoutMenu((prev) => !prev);
            setShowSpeakerMenu(false);
            setShowReactionsMenu(false);
          }}
          className={`p-3 rounded-xl transition cursor-pointer flex items-center gap-1 ${
            showLayoutMenu
              ? 'bg-brand-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Change Video Layout"
        >
          {layout === 'speaker' ? (
            <UserCheck className="w-5 h-5" />
          ) : layout === 'gallery' ? (
            <Rows className="w-5 h-5" />
          ) : layout === 'presentation' ? (
            <MonitorPlay className="w-5 h-5 text-brand-400" />
          ) : (
            <LayoutGrid className="w-5 h-5" />
          )}
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>

        {/* Participants drawer toggle */}
        <button
          onClick={onToggleParticipants}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isParticipantsOpen
              ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Participants List"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-slate-700 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-600">
            {participantCount}
          </span>
          {waitingCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-amber-500 animate-ping" />
          )}
          {isMeetingLocked && (
            <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full" title="Meeting is Locked">
              <Lock className="w-2.5 h-2.5" />
            </span>
          )}
        </button>

        {/* In-Call Chat drawer toggle */}
        <button
          onClick={onToggleChat}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isChatOpen
              ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="In-call Chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Shared Files Drawer toggle */}
        <button
          onClick={onToggleFiles}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isFilesOpen
              ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Shared Files"
        >
          <FolderUp className="w-5 h-5" />
          {unseenFilesCount > 0 && !isFilesOpen && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {unseenFilesCount}
            </span>
          )}
        </button>

        {/* Real-Time Collaborative Whiteboard Toggle */}
        <button
          onClick={onToggleWhiteboard}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isWhiteboardActive
              ? 'bg-brand-600 text-white shadow-lg ring-2 ring-brand-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isWhiteboardActive ? 'Close Whiteboard' : 'Open Collaborative Whiteboard'}
        >
          <Palette className="w-5 h-5" />
        </button>

        {/* Shared Meeting Notes Toggle */}
        <button
          onClick={onToggleNotes}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isNotesOpen
              ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Shared Meeting Notes"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Live Meeting Polls Toggle */}
        <button
          onClick={onTogglePolls}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isPollsOpen
              ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Meeting Polls"
        >
          <BarChart2 className="w-5 h-5" />
        </button>

        {/* Live Speech Transcription Drawer Toggle */}
        <button
          onClick={onToggleTranscript}
          className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isTranscriptOpen
              ? 'bg-brand-600 text-white shadow-lg ring-2 ring-brand-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Live Speech Transcription"
        >
          <Subtitles className="w-5 h-5" />
          {isTranscribing && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        {/* AI Meeting Insights & Action Items Modal Toggle */}
        <button
          onClick={onToggleInsights}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-brand-400 transition-all duration-200 cursor-pointer"
          title="AI Summary, Action Items & Insights"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Breakout Rooms Modal Toggle (Host / Co-Host or when Breakouts active) */}
        {(isHost || isCoHost) && (
          <button
            onClick={onToggleBreakout}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 cursor-pointer"
            title="Breakout Rooms Manager"
          >
            <SplitSquareVertical className="w-5 h-5" />
          </button>
        )}

        {/* Raise / Lower Hand Toggle */}
        <button
          onClick={onToggleRaiseHand}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isHandRaised
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/60'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Live Emoji Reactions Picker Tray Toggle */}
        <button
          onClick={() => {
            setShowReactionsMenu((prev) => !prev);
            setShowLayoutMenu(false);
            setShowSpeakerMenu(false);
          }}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            showReactionsMenu
              ? 'bg-brand-600 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Send Emoji Reaction"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Record Meeting Button (Host / Co-Host) */}
        {(isHost || isCoHost) && (
          <button
            onClick={onToggleRecording}
            className={`p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-2 ${
              isRecording
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-400/80 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-rose-400'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <Disc className={`w-5 h-5 ${isRecording ? 'animate-spin' : ''}`} />
            {isRecording && (
              <span className="text-xs font-mono font-bold hidden md:inline">
                {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:
                {(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </button>
        )}

        {/* Meeting Information Modal toggle */}
        <button
          onClick={onToggleInfo}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 cursor-pointer hidden sm:flex"
          title="Meeting Info & Invite Details"
        >
          <Info className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1" />

        {/* Leave or End Call Buttons */}
        {isHost ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onLeaveCall}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Leave Room"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
            <button
              onClick={onEndCallForAll}
              className="px-3 sm:px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              title="End Meeting for Everyone"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">End for All</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onLeaveCall}
            className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all duration-200 cursor-pointer flex items-center gap-2"
            title="Leave Meeting"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-sm font-semibold hidden sm:inline-block">Leave</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ControlsBar;