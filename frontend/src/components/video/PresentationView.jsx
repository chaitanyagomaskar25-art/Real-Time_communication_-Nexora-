import React, { useRef, useState, useEffect } from 'react';
import { Maximize2, Minimize2, ScreenShare, Sparkles } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

const PresentationView = ({
  screenStream,
  presenterName = 'Presenter',
  isLocalPresenting = false,
  participants = [],
  speakingPeers = {},
  peerConnectionStates = {},
  audioOutputDeviceId = 'default',
  pinnedPeerId = null,
  onPinPeer
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [objectFit, setObjectFit] = useState('contain'); // 'contain' | 'cover'
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div className="w-full h-[76vh] flex flex-col lg:flex-row gap-3 p-2 sm:p-4 max-w-7xl mx-auto animate-fade-in">
      {/* Main Presentation Stage */}
      <div
        ref={containerRef}
        className="relative flex-1 h-full min-h-[340px] bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group select-none"
      >
        {screenStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocalPresenting} // Always mute local screen capture element to prevent echo
            className={`w-full h-full transition-all duration-300 ${
              objectFit === 'contain' ? 'object-contain' : 'object-cover'
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500">
            <ScreenShare className="w-12 h-12 mb-2 animate-pulse text-brand-500" />
            <p className="text-sm font-medium">Connecting shared screen feed...</p>
          </div>
        )}

        {/* Top-Right Stage Controls (Hover) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button
            onClick={() => setObjectFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
            className="px-2.5 py-1 rounded-lg bg-dark-950/80 hover:bg-dark-900 border border-slate-700/80 text-slate-300 text-xs font-semibold backdrop-blur-md transition cursor-pointer"
            title="Toggle between Contain and Fill"
          >
            {objectFit === 'contain' ? 'Fill' : 'Fit'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-dark-950/80 hover:bg-dark-900 border border-slate-700/80 text-slate-300 text-xs backdrop-blur-md transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom-Left Presentation Watermark */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-dark-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs font-medium text-white shadow-lg pointer-events-none z-10">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span className="font-semibold text-brand-300">
            {isLocalPresenting ? 'Your Presentation Screen' : `${presenterName}'s Screen`}
          </span>
        </div>
      </div>

      {/* Side Participant Filmstrip (Attendee and Presenter Cameras) */}
      {participants.length > 0 && (
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:w-72 max-h-[76vh] shrink-0 pb-2 lg:pb-0">
          {participants.map((peer) => (
            <div key={peer.id} className="w-48 sm:w-56 lg:w-full h-32 shrink-0">
              <VideoPlayer
                stream={peer.stream}
                userName={peer.userName}
                isLocal={peer.isLocal}
                isMuted={peer.isMuted}
                isVideoOff={peer.isVideoOff}
                isSpeaking={Boolean(speakingPeers[peer.id])}
                connectionState={peerConnectionStates[peer.id] || 'connected'}
                isPinned={pinnedPeerId === peer.id}
                onPinToggle={() => onPinPeer && onPinPeer(peer.id)}
                audioOutputDeviceId={audioOutputDeviceId}
                isHandRaised={peer.isHandRaised}
                role={peer.role}
                isCoHost={peer.isCoHost}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PresentationView;
