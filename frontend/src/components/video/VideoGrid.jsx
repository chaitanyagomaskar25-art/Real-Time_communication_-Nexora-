import React from 'react';
import VideoPlayer from './VideoPlayer';

const VideoGrid = ({
  localStream,
  remoteStreams = {},
  userName = 'You',
  isAudioMuted = false,
  isVideoOff = false,
  speakingPeers = {},
  activeSpeakerId = null,
  peerConnectionStates = {},
  audioOutputDeviceId = 'default',
  layout = 'grid', // 'grid' | 'speaker' | 'gallery'
  pinnedPeerId = null,
  onPinPeer,
  isHost = false,
  isCoHost = false,
  isHandRaised = false
}) => {
  const remoteEntries = Object.entries(remoteStreams);
  const totalTiles = 1 + remoteEntries.length;

  // Compile all participants into an ordered list
  const allParticipants = [
    {
      id: 'local',
      stream: localStream,
      userName,
      isLocal: true,
      isMuted: isAudioMuted,
      isVideoOff,
      isSpeaking: Boolean(speakingPeers.local),
      connectionState: 'connected',
      isHandRaised: Boolean(isHandRaised),
      role: isHost ? 'host' : isCoHost ? 'co-host' : 'participant',
      isCoHost: Boolean(isCoHost)
    },
    ...remoteEntries.map(([socketId, peer]) => ({
      id: socketId,
      stream: peer.stream,
      userName: peer.userName || 'Participant',
      isLocal: false,
      isMuted: !peer.audio,
      isVideoOff: !peer.video,
      isSpeaking: Boolean(speakingPeers[socketId]),
      connectionState: peerConnectionStates[socketId] || peer.connectionState || 'connected',
      isHandRaised: Boolean(peer.isHandRaised),
      role: peer.role || (peer.isCoHost ? 'co-host' : 'participant'),
      isCoHost: Boolean(peer.isCoHost || peer.role === 'co-host')
    }))
  ];

  // Dynamic Grid View classes
  const getGridClasses = () => {
    if (totalTiles === 1) {
      return 'grid-cols-1 max-w-4xl mx-auto h-[72vh]';
    }
    if (totalTiles === 2) {
      return 'grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto h-[72vh]';
    }
    if (totalTiles <= 4) {
      return 'grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto h-[72vh]';
    }
    if (totalTiles <= 6) {
      return 'grid-cols-2 sm:grid-cols-3 max-w-7xl mx-auto h-[72vh]';
    }
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-7xl mx-auto h-[72vh]';
  };

  // Determine who should be spotlighted in 'speaker' view
  const getSpotlightPeer = () => {
    if (pinnedPeerId) {
      const pinned = allParticipants.find((p) => p.id === pinnedPeerId);
      if (pinned) return pinned;
    }

    if (activeSpeakerId) {
      const active = allParticipants.find((p) => p.id === activeSpeakerId);
      if (active) return active;
    }

    // Default to first remote peer if available, or local
    return allParticipants[1] || allParticipants[0];
  };

  // 1. SPEAKER VIEW LAYOUT
  if (layout === 'speaker') {
    const spotlight = getSpotlightPeer();
    const otherParticipants = allParticipants.filter((p) => p.id !== spotlight?.id);

    return (
      <div className="w-full h-[76vh] flex flex-col md:flex-row gap-3 p-2 sm:p-4 max-w-7xl mx-auto animate-fade-in">
        {/* Main Spotlight Video Area */}
        <div className="flex-1 h-full min-h-[300px]">
          {spotlight && (
            <VideoPlayer
              stream={spotlight.stream}
              userName={spotlight.userName}
              isLocal={spotlight.isLocal}
              isMuted={spotlight.isMuted}
              isVideoOff={spotlight.isVideoOff}
              isSpeaking={spotlight.isSpeaking}
              connectionState={spotlight.connectionState}
              isPinned={pinnedPeerId === spotlight.id}
              onPinToggle={() => onPinPeer && onPinPeer(spotlight.id)}
              audioOutputDeviceId={audioOutputDeviceId}
              isHandRaised={spotlight.isHandRaised}
              role={spotlight.role}
              isCoHost={spotlight.isCoHost}
            />
          )}
        </div>

        {/* Thumbnail Filmstrip */}
        {otherParticipants.length > 0 && (
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:w-64 max-h-[76vh] shrink-0 pb-2 md:pb-0">
            {otherParticipants.map((peer) => (
              <div key={peer.id} className="w-48 sm:w-56 md:w-full h-32 shrink-0">
                <VideoPlayer
                  stream={peer.stream}
                  userName={peer.userName}
                  isLocal={peer.isLocal}
                  isMuted={peer.isMuted}
                  isVideoOff={peer.isVideoOff}
                  isSpeaking={peer.isSpeaking}
                  connectionState={peer.connectionState}
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
  }

  // 2. GALLERY VIEW LAYOUT
  if (layout === 'gallery') {
    return (
      <div className="w-full max-w-7xl mx-auto h-[76vh] overflow-y-auto p-2 sm:p-4 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allParticipants.map((peer) => (
            <div key={peer.id} className="aspect-video w-full">
              <VideoPlayer
                stream={peer.stream}
                userName={peer.userName}
                isLocal={peer.isLocal}
                isMuted={peer.isMuted}
                isVideoOff={peer.isVideoOff}
                isSpeaking={peer.isSpeaking}
                connectionState={peer.connectionState}
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
      </div>
    );
  }

  // 3. DEFAULT GRID VIEW LAYOUT
  return (
    <div className={`grid gap-4 w-full p-2 sm:p-4 transition-all duration-300 ${getGridClasses()}`}>
      {allParticipants.map((peer) => (
        <VideoPlayer
          key={peer.id}
          stream={peer.stream}
          userName={peer.userName}
          isLocal={peer.isLocal}
          isMuted={peer.isMuted}
          isVideoOff={peer.isVideoOff}
          isSpeaking={peer.isSpeaking}
          connectionState={peer.connectionState}
          isPinned={pinnedPeerId === peer.id}
          onPinToggle={() => onPinPeer && onPinPeer(peer.id)}
          audioOutputDeviceId={audioOutputDeviceId}
          isHandRaised={peer.isHandRaised}
          role={peer.role}
          isCoHost={peer.isCoHost}
        />
      ))}
    </div>
  );
};

export default VideoGrid;
