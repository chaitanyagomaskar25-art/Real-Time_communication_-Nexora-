import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Shield,
  MessageSquare,
  Lock,
  Volume2,
  RefreshCw,
  AlertTriangle,
  User,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { getInitials } from '../../utils/formatters';

export const WhatsAppCallView = ({
  isAudioOnly = true,
  localStream,
  remoteStreams = {},
  userName = 'You',
  peerName = 'Participant',
  callDuration = 0,
  isAudioMuted = false,
  isVideoOff = true,
  speakingPeers = {},
  activeSpeakerId = null,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  onToggleChat,
  unreadCount = 0,
  deviceError = null,
  onRetryMedia,
  audioOutputDevices = [],
  selectedAudioOutputId = 'default',
  onSelectAudioOutput
}) => {
  const [swappedPip, setSwappedPip] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(Boolean(deviceError));
  const remoteEntries = Object.entries(remoteStreams);
  const remotePeer = remoteEntries.length > 0 ? remoteEntries[0][1] : null;
  const remoteSocketId = remoteEntries.length > 0 ? remoteEntries[0][0] : null;

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Keep permission help visible if a device error arises
  useEffect(() => {
    if (deviceError) {
      setShowPermissionHelp(true);
    }
  }, [deviceError]);

  const isRemoteSpeaking = remoteSocketId ? Boolean(speakingPeers[remoteSocketId]) : false;
  const isLocalSpeaking = Boolean(speakingPeers.local);
  const isConnected = remoteEntries.length > 0;
  const effectivePeerName = remotePeer?.userName || peerName || 'Participant';

  // Before peer joins, show local camera on main stage; once connected, show remote on main stage
  const showLocalOnMain = swappedPip || !isConnected;

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, showLocalOnMain]);

  // Bind remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remotePeer?.stream) {
      if (remoteVideoRef.current.srcObject !== remotePeer.stream) {
        remoteVideoRef.current.srcObject = remotePeer.stream;
      }
    }
  }, [remotePeer?.stream, showLocalOnMain]);

  // Apply audio output selection to remote video/audio
  useEffect(() => {
    if (
      remoteVideoRef.current &&
      selectedAudioOutputId &&
      'setSinkId' in HTMLMediaElement.prototype
    ) {
      remoteVideoRef.current.setSinkId(selectedAudioOutputId).catch(() => {});
    }
  }, [selectedAudioOutputId]);

  // Format call duration MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  // Determine if call is in Voice Call mode (either started as audioOnly or both cameras are off)
  const isVoiceMode = isAudioOnly && isVideoOff;

  return (
    <div className="relative w-full h-[78vh] sm:h-[82vh] max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-[#0b141a] select-none flex flex-col justify-between">
      {/* Background Ambience: Subtle WhatsApp Dark Theme Pattern & Gradient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0c1a24]/90 via-[#0b141a] to-[#071311] z-0" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Permission Blocked / Notice Alert Overlay */}
      {showPermissionHelp && deviceError && (
        <div className="absolute top-4 left-4 right-4 z-40 animate-fade-in">
          <div className="bg-amber-500/15 border border-amber-500/40 backdrop-blur-xl text-amber-200 px-4 py-3 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">
                  Microphone / Camera Access Blocked
                </p>
                <p className="text-amber-300/80">
                  Click the 🔒 lock icon in your browser address bar → set Microphone to &quot;Allow&quot; → click Try Again.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {onRetryMedia && (
                <button
                  onClick={async () => {
                    await onRetryMedia();
                    setShowPermissionHelp(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              )}
              <button
                onClick={() => setShowPermissionHelp(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER: Peer Info, Duration & Encryption */}
      <div className="relative z-10 pt-6 px-6 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/70 border border-slate-700/60 backdrop-blur-md text-[11px] font-medium text-slate-300 mb-3 shadow-sm">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>End-to-end encrypted</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-md">
          {effectivePeerName}
        </h2>

        <div className="flex items-center gap-2 mt-1.5">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {formatTime(callDuration)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Ringing / Waiting for peer...
            </span>
          )}
        </div>
      </div>

      {/* CENTER VIEWPORT: Voice Call Mode vs Video Call Mode */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        {isVoiceMode ? (
          /* ========================================================
             1. WHATSAPP VOICE CALL SCREEN
             ======================================================== */
          <div className="flex flex-col items-center justify-center text-center animate-fade-in">
            {/* Concentric Pulsing Soundwave Circles */}
            <div className="relative flex items-center justify-center">
              {/* Animated Glowing Ripple Rings when Speaking */}
              {(isRemoteSpeaking || isLocalSpeaking) && (
                <>
                  <div className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-ping pointer-events-none" />
                  <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-emerald-500/15 border border-emerald-400/30 animate-pulse pointer-events-none" />
                </>
              )}

              {/* Large WhatsApp Profile Avatar */}
              <div
                className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-emerald-800 via-teal-700 to-cyan-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-2xl border-4 transition-all duration-300 ${
                  isRemoteSpeaking
                    ? 'border-emerald-400 ring-8 ring-emerald-500/30 scale-105 shadow-emerald-500/30'
                    : 'border-slate-700/80 shadow-black/50'
                }`}
              >
                {effectivePeerName ? getInitials(effectivePeerName) : <User className="w-16 h-16" />}

                {/* Sub-badge for mute status */}
                {!remotePeer?.audio && isConnected && (
                  <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-rose-600 border-2 border-slate-900 flex items-center justify-center text-white shadow-lg">
                    <MicOff className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>

            {/* Speaking / Audio Equalizer Indicator */}
            <div className="mt-6 flex flex-col items-center">
              {isRemoteSpeaking ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-pulse">
                  <span className="flex gap-0.5 items-end h-3">
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-3" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-2" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-3.5" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span>{effectivePeerName} is speaking...</span>
                </div>
              ) : isLocalSpeaking ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>You are speaking</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  {isConnected ? 'Voice Call Connected' : 'Waiting for participant to join...'}
                </p>
              )}
            </div>

            {/* Hidden audio element to render remote audio stream */}
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        ) : (
          /* ========================================================
             2. WHATSAPP VIDEO CALL SCREEN (Full-Screen + PiP)
             ======================================================== */
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
            {/* Primary Full-Bleed Video Display (Remote by default, or Local if swapped or alone) */}
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {showLocalOnMain ? (
                /* Local Stream in Main Stage */
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover mirror ${isVideoOff ? 'hidden' : 'block'}`}
                />
              ) : (
                /* Remote Stream in Main Stage */
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${!remotePeer || !remotePeer.video ? 'hidden' : 'block'}`}
                />
              )}

              {/* Main Stage Avatar Fallback when camera is off */}
              {((showLocalOnMain && isVideoOff) || (!showLocalOnMain && (!remotePeer || !remotePeer.video))) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md">
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-800 to-teal-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl border-4 ${
                      isRemoteSpeaking ? 'border-emerald-400 ring-4 ring-emerald-500/40' : 'border-slate-700'
                    }`}
                  >
                    {showLocalOnMain ? getInitials(userName) : getInitials(effectivePeerName)}
                  </div>
                  <span className="mt-3 text-slate-300 text-sm font-semibold">
                    {showLocalOnMain ? `${userName} (You)` : effectivePeerName}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Camera is off</span>
                </div>
              )}

              {/* Main Stage Remote Participant Name & Status Tag */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{showLocalOnMain ? `${userName} (You)` : effectivePeerName}</span>
              </div>
            </div>

            {/* Floating Picture-in-Picture (PiP) Window (WhatsApp Style in Corner) */}
            {isConnected && (
              <div
                onClick={() => setSwappedPip((prev) => !prev)}
                className="absolute bottom-4 right-4 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-slate-900 cursor-pointer group hover:scale-105 transition-transform duration-200 z-20"
                title="Click to swap views"
              >
                {showLocalOnMain ? (
                  /* Remote Stream in PiP */
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${!remotePeer || !remotePeer.video ? 'hidden' : 'block'}`}
                  />
                ) : (
                  /* Local Stream in PiP */
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover mirror ${isVideoOff ? 'hidden' : 'block'}`}
                  />
                )}

                {/* PiP Avatar fallback */}
                {((!showLocalOnMain && isVideoOff) || (showLocalOnMain && (!remotePeer || !remotePeer.video))) && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white p-2">
                    <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold text-sm">
                      {showLocalOnMain ? getInitials(effectivePeerName) : getInitials(userName)}
                    </div>
                    <span className="text-[10px] text-slate-300 mt-1 truncate max-w-full">
                      {showLocalOnMain ? effectivePeerName : 'You'}
                    </span>
                  </div>
                )}

                {/* PiP Overlay Swap Icon */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Maximize2 className="w-5 h-5 drop-shadow" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION DOCK (WHATSAPP CALL BAR) */}
      <div className="relative z-10 pb-6 pt-2 px-6 flex items-center justify-center gap-4 sm:gap-6">
        {/* 1. MUTE / UNMUTE MICROPHONE */}
        <button
          onClick={onToggleAudio}
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/20'
              : 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/60'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* 2. TOGGLE CAMERA / SWITCH TO VIDEO */}
        <button
          onClick={onToggleVideo}
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer ${
            isVideoOff
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
          }`}
          title={isVideoOff ? 'Switch to Video Call' : 'Turn Off Camera'}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        {/* 3. SPEAKER / AUDIO OUTPUT TOGGLE */}
        {audioOutputDevices && audioOutputDevices.length > 1 && (
          <button
            onClick={() => {
              if (onSelectAudioOutput) {
                const nextIdx =
                  (audioOutputDevices.findIndex((d) => d.deviceId === selectedAudioOutputId) + 1) %
                  audioOutputDevices.length;
                onSelectAudioOutput(audioOutputDevices[nextIdx].deviceId);
              }
            }}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60 flex items-center justify-center transition shadow-xl cursor-pointer"
            title="Switch Audio Output Speaker"
          >
            <Volume2 className="w-6 h-6" />
          </button>
        )}

        {/* 4. RETURN TO CHAT */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60 flex items-center justify-center transition shadow-xl cursor-pointer"
            title="Return to Chat"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-slate-900 shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* 5. END CALL (RED CIRCLE) */}
        <button
          onClick={onLeaveCall}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white flex items-center justify-center transition-all duration-200 shadow-2xl shadow-rose-600/40 ring-4 ring-rose-500/30 cursor-pointer"
          title="End Call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};

export default WhatsAppCallView;
