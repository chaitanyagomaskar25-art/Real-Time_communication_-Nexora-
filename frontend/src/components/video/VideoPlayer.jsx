import React, { useEffect, useRef } from 'react';
import { MicOff, User, Pin, PinOff, Wifi, WifiOff, Shield, Crown } from 'lucide-react';
import { getInitials } from '../../utils/formatters';

const VideoPlayer = ({
  stream,
  userName = 'Participant',
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  connectionState = 'connected',
  isPinned = false,
  onPinToggle,
  audioOutputDeviceId,
  isHandRaised = false,
  role = 'participant',
  isCoHost = false
}) => {
  const videoRef = useRef(null);

  // Bind MediaStream to Video Element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  // Apply Speaker Output Selection (HTMLMediaElement.setSinkId)
  useEffect(() => {
    if (!isLocal && videoRef.current && audioOutputDeviceId && 'setSinkId' in HTMLMediaElement.prototype) {
      videoRef.current.setSinkId(audioOutputDeviceId).catch((err) => {
        console.warn('Failed to set audio sink ID:', err);
      });
    }
  }, [audioOutputDeviceId, isLocal]);

  // Network connection status indicator
  const renderConnectionBadge = () => {
    if (isLocal) return null;

    if (connectionState === 'connecting') {
      return (
        <span
          className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px]"
          title="Connecting..."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          Connecting
        </span>
      );
    }

    if (connectionState === 'failed' || connectionState === 'disconnected') {
      return (
        <span
          className="flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded text-[10px]"
          title="Connection Reconnecting / Failed"
        >
          <WifiOff className="w-3 h-3 text-rose-400" />
          Offline
        </span>
      );
    }

    return (
      <span
        className="flex items-center gap-1 bg-slate-900/60 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]"
        title="Direct P2P Encrypted"
      >
        <Wifi className="w-3 h-3 text-emerald-400" />
      </span>
    );
  };

  return (
    <div
      className={`relative w-full h-full min-h-[200px] bg-slate-900 rounded-2xl overflow-hidden border shadow-xl flex items-center justify-center group transition-all duration-300 ${
        isSpeaking
          ? 'ring-2 ring-emerald-500 border-emerald-500/50 shadow-emerald-500/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Local video must always be muted to prevent echo/feedback loops
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLocal ? 'mirror' : ''
        } ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Avatar Fallback when Camera is Off */}
      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm select-none">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-2xl border-2 transition-all duration-300 ${
              isSpeaking
                ? 'border-emerald-400 ring-4 ring-emerald-500/40 scale-105'
                : 'border-brand-500/30'
            }`}
          >
            {userName ? getInitials(userName) : <User className="w-10 h-10" />}
          </div>
          <span className="mt-3 text-slate-300 text-sm font-medium">
            {userName} {isLocal && '(You)'}
          </span>
        </div>
      )}

      {/* Top Left: Pin / Spotlight Button */}
      {onPinToggle && (
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button
            onClick={onPinToggle}
            className={`p-1.5 rounded-lg backdrop-blur-md border text-xs flex items-center gap-1 transition ${
              isPinned
                ? 'bg-brand-600 text-white border-brand-500'
                : 'bg-dark-950/70 text-slate-300 hover:text-white border-slate-700 hover:bg-dark-900/80'
            }`}
            title={isPinned ? 'Unpin participant' : 'Pin to main screen'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Top Right: Badges (Local User, Role, Hand Raised & Network Status) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {isHandRaised && (
          <span className="flex items-center gap-1 bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] shadow-lg animate-pulse" title="Hand Raised">
            <span>✋</span>
            <span className="hidden sm:inline">Hand</span>
          </span>
        )}
        {role === 'host' && (
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold" title="Meeting Host">
            <Crown className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Host</span>
          </span>
        )}
        {(role === 'co-host' || isCoHost) && (
          <span className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold" title="Co-Host">
            <Shield className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">Co-Host</span>
          </span>
        )}
        {renderConnectionBadge()}
        {isLocal && (
          <div className="bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
            YOU
          </div>
        )}
      </div>

      {/* Bottom Overlay: Participant Name & Speaking Status */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 bg-dark-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-medium text-white shadow-md max-w-[85%] truncate">
          <span className="truncate">
            {userName} {isLocal ? '(You)' : ''}
          </span>

          {/* Active Speaking Equalizer Wave */}
          {isSpeaking && (
            <span className="flex items-center gap-0.5 text-emerald-400 shrink-0" title="Speaking">
              <span className="w-1 h-3 rounded-full bg-emerald-400 animate-bounce" />
              <span className="w-1 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="w-1 h-3.5 rounded-full bg-emerald-400 animate-bounce delay-75" />
            </span>
          )}

          {/* Audio Muted Indicator */}
          {isMuted && (
            <span className="p-0.5 rounded bg-rose-500/20 text-rose-400 shrink-0" title="Microphone muted">
              <MicOff className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
