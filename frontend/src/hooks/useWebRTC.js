import { useState, useEffect, useRef, useCallback } from 'react';
import { ICE_SERVERS } from '../utils/constants';

// Helper to create a fallback silent audio + canvas video stream if hardware camera/mic is unavailable
const createFallbackStream = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Camera Inactive (Simulated)', canvas.width / 2, canvas.height / 2);
  }
  const stream = canvas.captureStream(15);

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const dst = osc.connect(audioCtx.createMediaStreamDestination());
      osc.start();
      const track = dst.stream.getAudioTracks()[0];
      if (track) {
        track.enabled = false;
        stream.addTrack(track);
      }
    }
  } catch {
    // Ignore audio context errors in headless environments
  }

  return stream;
};

export const useWebRTC = (socket, roomId, user, options = {}) => {
  const cleanRoomId = (roomId || '').toLowerCase().trim();
  const isHost = Boolean(options.isHost);
  const requiresWaitingRoom = Boolean(options.requiresWaitingRoom);
  const isAudioOnly = Boolean(options.audioOnly);

  // Participant Role & Hand states
  const [isCoHost, setIsCoHost] = useState(Boolean(options.isCoHost));
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [displayName, setDisplayName] = useState(user?.fullName || user?.name || 'Guest User');
  const [roomPermissions, setRoomPermissions] = useState({
    allowScreenShare: true,
    allowParticipantUnmute: true,
    allowParticipantVideo: true,
    allowParticipantWhiteboard: true,
    allowNameChange: true,
    isLocked: Boolean(options.isLocked)
  });
  const [reactions, setReactions] = useState([]); // [{ id, userName, emoji, timestamp, leftPercent }]
  const [participantNotice, setParticipantNotice] = useState(null); // { type, message } | null

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [socketId]: { stream, userName, role, isCoHost, isHandRaised, audio, video, connectionState } }

  // Screen sharing states
  const [screenStream, setScreenStream] = useState(null); // Local screen stream
  const [remoteScreenStream, setRemoteScreenStream] = useState(null); // Remote screen stream
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [presenter, setPresenter] = useState(null); // { socketId, userId, userName } | null

  // Media toggles
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(Boolean(options.audioOnly));
  const [isInitializing, setIsInitializing] = useState(true);
  const [deviceError, setDeviceError] = useState(null);

  // Audio output device selection (speaker)
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState('default');

  // Speaking indicator & active speaker detection
  const [speakingPeers, setSpeakingPeers] = useState({}); // { [socketId]: boolean, local: boolean }
  const [activeSpeakerId, setActiveSpeakerId] = useState(null); // 'local' | socketId

  // Peer connection state tracking
  const [peerConnectionStates, setPeerConnectionStates] = useState({}); // { [socketId]: 'connecting' | 'connected' | 'disconnected' | 'failed' }

  // Meeting management states
  const [inWaitingRoom, setInWaitingRoom] = useState(false);
  const [waitingList, setWaitingList] = useState([]); // [{ socketId, userId, userName, requestedAt }]
  const [isMeetingLocked, setIsMeetingLocked] = useState(Boolean(options.isLocked));
  const [meetingEndedNotice, setMeetingEndedNotice] = useState(null);
  const [participantCount, setParticipantCount] = useState(1);

  // Refs to avoid stale closures in callbacks
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenSendersRef = useRef({}); // { [socketId]: RTCRtpSender[] }
  const peersRef = useRef({}); // { [socketId]: RTCPeerConnection }
  const remoteStreamsRef = useRef({});
  const candidateQueuesRef = useRef({}); // { [socketId]: RTCIceCandidate[] }
  const audioContextRef = useRef(null);
  const audioAnalysersRef = useRef({}); // { local: AnalyserNode, [socketId]: AnalyserNode }
  const audioAnimFrameRef = useRef(null);

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // Cleanly remove a peer and its resources
  const removePeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      try {
        peersRef.current[socketId].close();
      } catch {
        // Safe close
      }
      delete peersRef.current[socketId];
    }

    if (screenSendersRef.current[socketId]) {
      delete screenSendersRef.current[socketId];
    }

    if (candidateQueuesRef.current[socketId]) {
      delete candidateQueuesRef.current[socketId];
    }

    if (audioAnalysersRef.current[socketId]) {
      try {
        audioAnalysersRef.current[socketId].disconnect();
      } catch {
        // Disconnect
      }
      delete audioAnalysersRef.current[socketId];
    }

    setPeerConnectionStates((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });

    setSpeakingPeers((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });

    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  }, []);

  // Setup Web Audio API Analyser for Speaking Detection
  const setupAudioAnalyser = useCallback((stream, key) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !stream) return;

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      audioAnalysersRef.current[key] = analyser;
    } catch {
      // Audio analysis fallback
    }
  }, []);

  // Periodic volume check loop for speaking indicators
  useEffect(() => {
    let isRunning = true;
    const buffer = new Uint8Array(256);

    const checkVolume = () => {
      if (!isRunning) return;

      const analysers = audioAnalysersRef.current;
      const newSpeaking = {};
      let highestVolume = 0;
      let topSpeaker = null;

      Object.entries(analysers).forEach(([key, analyser]) => {
        try {
          analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const average = sum / buffer.length;

          // Threshold for speaking detection (scale 0-255)
          const isSpeaking = average > 14;
          newSpeaking[key] = isSpeaking;

          if (isSpeaking && average > highestVolume) {
            highestVolume = average;
            topSpeaker = key;
          }
        } catch {
          newSpeaking[key] = false;
        }
      });

      setSpeakingPeers(newSpeaking);
      if (topSpeaker) {
        setActiveSpeakerId(topSpeaker);
      }

      audioAnimFrameRef.current = setTimeout(checkVolume, 150);
    };

    audioAnimFrameRef.current = setTimeout(checkVolume, 300);

    return () => {
      isRunning = false;
      if (audioAnimFrameRef.current) {
        clearTimeout(audioAnimFrameRef.current);
      }
    };
  }, []);

  // Enumerate Audio Output Devices (Speakers)
  const enumerateAudioOutputDevices = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${index + 1}`
          }));
        setAudioOutputDevices(outputs);
      } catch {
        // Enumerate fallback
      }
    }
  }, []);

  // Change Audio Output (Speaker)
  const setAudioOutputDevice = useCallback((deviceId) => {
    setSelectedAudioOutputId(deviceId);
  }, []);

  // Create an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((targetSocketId, targetUserName = 'Participant') => {
    if (peersRef.current[targetSocketId]) {
      return peersRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetSocketId] = pc;
    candidateQueuesRef.current[targetSocketId] = [];
    screenSendersRef.current[targetSocketId] = [];

    setPeerConnectionStates((prev) => ({
      ...prev,
      [targetSocketId]: 'connecting'
    }));

    // Add local camera & mic tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add active screen share tracks if currently presenting
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, screenStreamRef.current);
        screenSendersRef.current[targetSocketId].push(sender);
      });
    }

    // ICE Candidate handler: send to target peer via Socket.IO
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Remote Track Handler: stream arrived from remote peer (camera or screen share)
    pc.ontrack = (event) => {
      const remoteStream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      if (!remoteStream) return;

      if (event.track.kind === 'video') {
        const existingPeer = remoteStreamsRef.current[targetSocketId];
        // If this remote peer already has an active camera stream, a second video track is their screen share!
        if (existingPeer && existingPeer.stream && existingPeer.stream.getVideoTracks().length > 0) {
          setRemoteScreenStream(remoteStream);
          event.track.onended = () => {
            setRemoteScreenStream(null);
          };
        } else {
          // Primary video stream (Camera)
          setupAudioAnalyser(remoteStream, targetSocketId);
          setRemoteStreams((prev) => {
            const current = prev[targetSocketId] || {};
            return {
              ...prev,
              [targetSocketId]: {
                ...current,
                stream: remoteStream,
                userName: targetUserName || current.userName || 'Participant',
                audio: current.audio !== undefined ? current.audio : true,
                video: current.video !== undefined ? current.video : true
              }
            };
          });
        }
      } else if (event.track.kind === 'audio') {
        setupAudioAnalyser(remoteStream, targetSocketId);
        setRemoteStreams((prev) => {
          const current = prev[targetSocketId];
          if (!current) return prev;
          return {
            ...prev,
            [targetSocketId]: {
              ...current,
              stream: remoteStream
            }
          };
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setPeerConnectionStates((prev) => ({
        ...prev,
        [targetSocketId]: state
      }));

      if (state === 'failed') {
        console.warn(`Peer [${targetSocketId}] connection failed, requesting ICE restart...`);
        if (socket) {
          socket.emit('request-ice-restart', { targetSocketId });
        }
      } else if (state === 'closed') {
        removePeer(targetSocketId);
      }
    };

    // ICE Connection state change
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch {
          // Restart ICE
        }
      }
    };

    return pc;
  }, [socket, setupAudioAnalyser, removePeer]);

  // Stop Screen Share
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Remove screen track senders from each peer connection & renegotiate
    for (const [peerId, pc] of Object.entries(peersRef.current)) {
      try {
        const senders = screenSendersRef.current[peerId] || [];
        senders.forEach((sender) => {
          try {
            pc.removeTrack(sender);
          } catch {
            // Ignore
          }
        });
        delete screenSendersRef.current[peerId];

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket) {
          socket.emit('signal-offer', { targetSocketId: peerId, sdp: offer });
        }
      } catch (err) {
        console.warn('Failed to renegotiate after stopping screen share', err);
      }
    }

    if (socket) {
      socket.emit('stop-screen-share');
    }
  }, [socket]);

  // Start Screen Share using getDisplayMedia
  const startScreenShare = useCallback(async () => {
    if (roomPermissions?.allowScreenShare === false && !isHost && !isCoHost) {
      alert('Screen sharing has been restricted to hosts only by the meeting host.');
      return;
    }

    if (presenter && presenter.socketId !== socket?.id) {
      alert(`${presenter.userName} is currently sharing their screen. Only one presenter is allowed at a time.`);
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen sharing is not supported by your browser.');
      return;
    }

    try {
      // Capture Screen, Window, or Tab
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      // Auto stop sharing when browser's native stop button is clicked
      screenTrack.onended = () => {
        stopScreenShare();
      };

      // Add screen track to every peer connection and renegotiate
      for (const [peerId, pc] of Object.entries(peersRef.current)) {
        try {
          const sender = pc.addTrack(screenTrack, displayStream);
          if (!screenSendersRef.current[peerId]) {
            screenSendersRef.current[peerId] = [];
          }
          screenSendersRef.current[peerId].push(sender);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socket) {
            socket.emit('signal-offer', { targetSocketId: peerId, sdp: offer });
          }
        } catch (err) {
          console.error('Failed to add screen track to peer', peerId, err);
        }
      }

      if (socket) {
        socket.emit('start-screen-share');
      }
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err.message);
    }
  }, [presenter, socket, stopScreenShare, roomPermissions, isHost, isCoHost]);

  // Toggle Screen Share
  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // Host Action: Stop another participant's screen share
  const hostStopScreenShare = useCallback((targetSocketId) => {
    if (socket && isHost) {
      socket.emit('host-stop-screen-share', { targetSocketId });
    }
  }, [socket, isHost]);

  const hasInitializedMediaRef = useRef(false);

  // Safely close and cleanup AudioContext without throwing unhandled promise rejections
  const safelyCloseAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      audioAnalysersRef.current = {};
      try {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {
        // Safe close
      }
    }
  }, []);

  // Initialize or re-request Local Media Stream
  const initMedia = useCallback(async (forceAudioOnly = isAudioOnly) => {
    let stream;
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (forceAudioOnly) {
        // Voice Call: Request ONLY microphone access (do not prompt or fail on camera)
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false
          });
          const fallback = createFallbackStream();
          const dummyVideoTrack = fallback.getVideoTracks()[0];
          if (dummyVideoTrack) {
            dummyVideoTrack.enabled = false;
          }
          const combinedStream = new MediaStream();
          if (dummyVideoTrack) combinedStream.addTrack(dummyVideoTrack);
          audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
          stream = combinedStream;
          setDeviceError(null);
          setIsVideoOff(true);
        } catch (micErr) {
          console.warn('Microphone access failed for voice call, using fallback stream:', micErr.message);
          setDeviceError(micErr.message);
          setIsVideoOff(true);
          stream = createFallbackStream();
        }
      } else {
        // Video Call: Request both camera and microphone
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            },
            audio: audioConstraints
          });
          setDeviceError(null);
          setIsVideoOff(false);
        } catch (deviceErr) {
          // If combined video+audio request failed, try microphone only
          try {
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: false
            });
            const fallback = createFallbackStream();
            const dummyVideoTrack = fallback.getVideoTracks()[0];
            if (dummyVideoTrack) {
              dummyVideoTrack.enabled = false;
            }
            const combinedStream = new MediaStream();
            if (dummyVideoTrack) combinedStream.addTrack(dummyVideoTrack);
            audioOnlyStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
            stream = combinedStream;
            setIsVideoOff(true);
            setDeviceError('Camera access unavailable. Using microphone only.');
          } catch (micErr) {
            console.warn('Real camera/mic access failed, using fallback stream:', deviceErr.message);
            setDeviceError(deviceErr.message);
            stream = createFallbackStream();
          }
        }
      }
    } else {
      stream = createFallbackStream();
    }

    // If active peer connections exist, replace the tracks in RTCRtpSenders
    if (localStreamRef.current) {
      const oldStream = localStreamRef.current;
      const newAudioTrack = stream.getAudioTracks()[0];
      const newVideoTrack = stream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach((pc) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            if (sender.track.kind === 'audio' && newAudioTrack) {
              sender.replaceTrack(newAudioTrack).catch(() => {});
            } else if (sender.track.kind === 'video' && newVideoTrack) {
              sender.replaceTrack(newVideoTrack).catch(() => {});
            }
          }
        });
      });

      oldStream.getTracks().forEach((t) => t.stop());
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setupAudioAnalyser(stream, 'local');
    setIsInitializing(false);
    enumerateAudioOutputDevices();
    return stream;
  }, [isAudioOnly, setupAudioAnalyser, enumerateAudioOutputDevices]);

  // Initial media mount effect - only run once on hook mount
  useEffect(() => {
    if (!hasInitializedMediaRef.current) {
      hasInitializedMediaRef.current = true;
      initMedia(isAudioOnly);
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      safelyCloseAudioContext();
    };
  }, [initMedia, isAudioOnly, safelyCloseAudioContext]);

  // Public method to retry microphone or camera after user enables it in browser
  const retryMediaAccess = useCallback(() => {
    setDeviceError(null);
    return initMedia(isAudioOnly);
  }, [initMedia, isAudioOnly]);

  // Leave Call & Cleanup
  const leaveCall = useCallback(() => {
    if (socket) {
      socket.emit('leave-room');
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    safelyCloseAudioContext();
    Object.keys(peersRef.current).forEach((key) => {
      removePeer(key);
    });
  }, [socket, removePeer, safelyCloseAudioContext]);

  // Socket.IO WebRTC Signaling Bindings
  useEffect(() => {
    if (!socket || !roomId || isInitializing) return;

    const userName = user?.fullName || user?.name || 'Guest User';
    const userId = user?.id || user?._id || socket.id;

    // Join room / request admission
    socket.emit('join-room', {
      roomId: cleanRoomId,
      userId,
      userName,
      isHost,
      requiresWaitingRoom
    });

    // Auto-clean reactions after 3.5s
    const reactionCleanInterval = setInterval(() => {
      const now = Date.now();
      setReactions((prev) => prev.filter((r) => now - r.timestamp < 3500));
    }, 1000);

    // Received existing participants from server: Make offers to them
    const handleExistingParticipants = async ({
      participants,
      participantCount: count,
      presenter: initialPresenter,
      permissions,
      myRole,
      isCoHost: serverIsCoHost
    }) => {
      setInWaitingRoom(false);
      if (count) setParticipantCount(count);
      if (initialPresenter) setPresenter(initialPresenter);
      if (permissions) setRoomPermissions(permissions);
      if (serverIsCoHost !== undefined) setIsCoHost(Boolean(serverIsCoHost));
      else if (myRole === 'co-host') setIsCoHost(true);

      const streamMap = {};
      for (const peer of participants) {
        streamMap[peer.socketId] = {
          stream: null,
          userName: peer.userName || 'Participant',
          userId: peer.userId,
          role: peer.role || (peer.isCoHost ? 'co-host' : 'participant'),
          isCoHost: Boolean(peer.isCoHost || peer.role === 'co-host'),
          isHandRaised: Boolean(peer.isHandRaised),
          handRaisedAt: peer.handRaisedAt || null,
          isSpeaking: Boolean(peer.isSpeaking),
          connectionState: peer.connectionState || 'connected',
          audio: peer.audio !== undefined ? peer.audio : true,
          video: peer.video !== undefined ? peer.video : true
        };
        const pc = createPeerConnection(peer.socketId, peer.userName);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal-offer', {
            targetSocketId: peer.socketId,
            sdp: offer
          });
        } catch (err) {
          console.error('Failed to create offer for peer', peer.socketId, err);
        }
      }
      setRemoteStreams((prev) => ({ ...streamMap, ...prev }));
    };

    // New participant joined
    const handleUserConnected = ({
      socketId,
      userId: newUserId,
      userName: newUserName,
      role = 'participant',
      isCoHost: newPeerCoHost = false,
      audio = true,
      video = true,
      isHandRaised: newPeerHandRaised = false,
      participantCount: count
    }) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [socketId]: {
          stream: prev[socketId]?.stream || null,
          userName: newUserName || 'Participant',
          userId: newUserId,
          role,
          isCoHost: Boolean(newPeerCoHost || role === 'co-host'),
          isHandRaised: Boolean(newPeerHandRaised),
          handRaisedAt: null,
          isSpeaking: false,
          connectionState: 'connected',
          audio: audio !== undefined ? audio : true,
          video: video !== undefined ? video : true
        }
      }));
      createPeerConnection(socketId, newUserName);
      if (count) setParticipantCount(count);
    };

    // Received SDP Offer from a peer
    const handleSignalOffer = async ({ callerSocketId, callerUserName, sdp }) => {
      const pc = createPeerConnection(callerSocketId, callerUserName);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Process any queued ICE candidates that arrived before remote description
        const queue = candidateQueuesRef.current[callerSocketId] || [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Queued ICE candidate add error', e);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal-answer', {
          targetSocketId: callerSocketId,
          sdp: answer
        });
      } catch (err) {
        console.error('Failed to handle SDP offer from', callerSocketId, err);
      }
    };

    // Received SDP Answer
    const handleSignalAnswer = async ({ responderSocketId, sdp }) => {
      const pc = peersRef.current[responderSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          // Process any queued ICE candidates
          const queue = candidateQueuesRef.current[responderSocketId] || [];
          while (queue.length > 0) {
            const candidate = queue.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Queued ICE candidate add error', e);
            }
          }
        } catch (err) {
          console.error('Failed to set remote description on answer', err);
        }
      }
    };

    // Received ICE Candidate
    const handleIceCandidate = async ({ senderSocketId, candidate }) => {
      const pc = peersRef.current[senderSocketId];
      if (candidate) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Failed to add received ICE candidate', err);
          }
        } else {
          // Buffer candidate until remote description is set
          if (!candidateQueuesRef.current[senderSocketId]) {
            candidateQueuesRef.current[senderSocketId] = [];
          }
          candidateQueuesRef.current[senderSocketId].push(candidate);
        }
      }
    };

    // ICE Restart Request received
    const handleRequestIceRestart = async ({ requesterSocketId }) => {
      const pc = peersRef.current[requesterSocketId];
      if (pc) {
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          socket.emit('signal-offer', {
            targetSocketId: requesterSocketId,
            sdp: offer
          });
        } catch (err) {
          console.error('Failed to create ICE restart offer', err);
        }
      }
    };

    // Presenter Changed (Screen Sharing Start / Stop broadcast)
    const handlePresenterChanged = ({ presenter: newPresenter }) => {
      setPresenter(newPresenter);
      if (!newPresenter) {
        setRemoteScreenStream(null);
      }
    };

    // Screen Share Rejected (Another participant is already sharing)
    const handleScreenShareRejected = ({ message }) => {
      alert(message || 'Screen sharing rejected: only one active presenter allowed.');
    };

    // Force Stop Screen Share (Host commanded stop)
    const handleForceStopScreenShare = ({ message }) => {
      alert(message || 'The host has stopped your screen sharing.');
      stopScreenShare();
    };

    // Peer toggled audio/video
    const handlePeerMediaToggled = ({ socketId, kind, enabled }) => {
      setRemoteStreams((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            [kind]: enabled
          }
        };
      });
    };

    // Remote peer left
    const handleUserDisconnected = ({ socketId, participantCount: count }) => {
      removePeer(socketId);
      if (count) setParticipantCount(count);
      setPresenter((prev) => {
        if (prev && prev.socketId === socketId) {
          setRemoteScreenStream(null);
          return null;
        }
        return prev;
      });
    };

    // Waiting room events
    const handleWaitingRoomStatus = ({ inWaitingRoom: inWaiting }) => {
      setInWaitingRoom(Boolean(inWaiting));
    };

    const handleAdmittedToMeeting = (payload = {}) => {
      setInWaitingRoom(false);
      if (payload.permissions) setRoomPermissions(payload.permissions);
    };

    const handleRejectedFromMeeting = ({ message }) => {
      setInWaitingRoom(false);
      setMeetingEndedNotice(message || 'The host declined your join request.');
    };

    const handleParticipantWaiting = (waitingPeer) => {
      setWaitingList((prev) => {
        if (prev.some((p) => p.socketId === waitingPeer.socketId)) return prev;
        return [...prev, waitingPeer];
      });
    };

    const handleWaitingListUpdated = ({ waiting }) => {
      setWaitingList(waiting || []);
    };

    // Meeting host control events
    const handleMeetingLockStatus = ({ isLocked }) => {
      setIsMeetingLocked(Boolean(isLocked));
    };

    const handleMeetingEnded = ({ message }) => {
      setMeetingEndedNotice(message || 'The meeting has been ended by the host.');
    };

    // Participant Management Event Listeners
    const handleForceMuteAudio = ({ message }) => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsAudioMuted(true);
      setParticipantNotice({
        type: 'warning',
        message: message || 'You have been muted by a host or co-host.'
      });
    };

    const handleForceDisableVideo = ({ message }) => {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsVideoOff(true);
      setParticipantNotice({
        type: 'warning',
        message: message || 'Your camera has been disabled by a host or co-host.'
      });
    };

    const handleRemovedFromMeeting = ({ message }) => {
      setMeetingEndedNotice(message || 'You have been removed from the meeting by the host.');
      leaveCall();
    };

    const handleCohostStatusChanged = ({ isCoHost: newStatus, message }) => {
      setIsCoHost(Boolean(newStatus));
      setParticipantNotice({
        type: 'info',
        message: message || (newStatus ? 'You are now a Co-Host!' : 'Your Co-Host privileges were revoked.')
      });
    };

    const handleParticipantRoleChanged = ({ socketId, role }) => {
      setRemoteStreams((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            role,
            isCoHost: role === 'co-host'
          }
        };
      });
    };

    const handleParticipantHandToggled = ({ socketId, isHandRaised: raised, handRaisedAt }) => {
      if (socket && socketId === socket.id) {
        setIsHandRaised(Boolean(raised));
      }
      setRemoteStreams((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            isHandRaised: Boolean(raised),
            handRaisedAt: handRaisedAt || (raised ? new Date().toISOString() : null)
          }
        };
      });
    };

    const handleAllHandsLowered = () => {
      setIsHandRaised(false);
      setRemoteStreams((prev) => {
        const updated = {};
        Object.entries(prev).forEach(([id, p]) => {
          updated[id] = { ...p, isHandRaised: false, handRaisedAt: null };
        });
        return updated;
      });
    };

    const handleParticipantNameChanged = ({ socketId, newName, userName: altName }) => {
      const updatedName = newName || altName;
      if (socket && socketId === socket.id) {
        setDisplayName(updatedName);
      }
      setRemoteStreams((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            userName: updatedName
          }
        };
      });
    };

    const handleReactionReceived = ({ id, userName: senderName, emoji, timestamp }) => {
      const reactionId = id || `react-${Date.now()}-${Math.random()}`;
      const leftPercent = 10 + Math.floor(Math.random() * 80);
      setReactions((prev) => [
        ...prev.slice(-15),
        { id: reactionId, userName: senderName, emoji, timestamp: timestamp || Date.now(), leftPercent }
      ]);
    };

    const handleRoomPermissionsUpdated = ({ permissions }) => {
      setRoomPermissions((prev) => ({
        ...prev,
        ...permissions
      }));
    };

    const handlePeerSpeakingState = ({ socketId, isSpeaking: speaking }) => {
      setSpeakingPeers((prev) => ({
        ...prev,
        [socketId]: Boolean(speaking)
      }));
    };

    const handlePeerConnectionState = ({ socketId, state }) => {
      setPeerConnectionStates((prev) => ({
        ...prev,
        [socketId]: state
      }));
    };

    const handleErrorNotification = ({ message }) => {
      setParticipantNotice({ type: 'error', message: message || 'An error occurred.' });
    };

    socket.on('existing-participants', handleExistingParticipants);
    socket.on('user-connected', handleUserConnected);
    socket.on('signal-offer', handleSignalOffer);
    socket.on('signal-answer', handleSignalAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('request-ice-restart', handleRequestIceRestart);
    socket.on('presenter-changed', handlePresenterChanged);
    socket.on('screen-share-rejected', handleScreenShareRejected);
    socket.on('force-stop-screen-share', handleForceStopScreenShare);
    socket.on('peer-media-toggled', handlePeerMediaToggled);
    socket.on('user-disconnected', handleUserDisconnected);

    // Waiting room & host control listeners
    socket.on('waiting-room-status', handleWaitingRoomStatus);
    socket.on('admitted-to-meeting', handleAdmittedToMeeting);
    socket.on('rejected-from-meeting', handleRejectedFromMeeting);
    socket.on('participant-waiting', handleParticipantWaiting);
    socket.on('waiting-list-updated', handleWaitingListUpdated);
    socket.on('meeting-lock-status', handleMeetingLockStatus);
    socket.on('meeting-ended', handleMeetingEnded);

    // Participant management listeners
    socket.on('force-mute-audio', handleForceMuteAudio);
    socket.on('force-disable-video', handleForceDisableVideo);
    socket.on('removed-from-meeting', handleRemovedFromMeeting);
    socket.on('cohost-status-changed', handleCohostStatusChanged);
    socket.on('participant-role-changed', handleParticipantRoleChanged);
    socket.on('participant-hand-toggled', handleParticipantHandToggled);
    socket.on('all-hands-lowered', handleAllHandsLowered);
    socket.on('participant-name-changed', handleParticipantNameChanged);
    socket.on('reaction-received', handleReactionReceived);
    socket.on('room-permissions-updated', handleRoomPermissionsUpdated);
    socket.on('peer-speaking-state', handlePeerSpeakingState);
    socket.on('peer-connection-state', handlePeerConnectionState);
    socket.on('error-notification', handleErrorNotification);

    const activePeers = peersRef.current;
    return () => {
      clearInterval(reactionCleanInterval);

      socket.off('existing-participants', handleExistingParticipants);
      socket.off('user-connected', handleUserConnected);
      socket.off('signal-offer', handleSignalOffer);
      socket.off('signal-answer', handleSignalAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('request-ice-restart', handleRequestIceRestart);
      socket.off('presenter-changed', handlePresenterChanged);
      socket.off('screen-share-rejected', handleScreenShareRejected);
      socket.off('force-stop-screen-share', handleForceStopScreenShare);
      socket.off('peer-media-toggled', handlePeerMediaToggled);
      socket.off('user-disconnected', handleUserDisconnected);

      socket.off('waiting-room-status', handleWaitingRoomStatus);
      socket.off('admitted-to-meeting', handleAdmittedToMeeting);
      socket.off('rejected-from-meeting', handleRejectedFromMeeting);
      socket.off('participant-waiting', handleParticipantWaiting);
      socket.off('waiting-list-updated', handleWaitingListUpdated);
      socket.off('meeting-lock-status', handleMeetingLockStatus);
      socket.off('meeting-ended', handleMeetingEnded);

      socket.off('force-mute-audio', handleForceMuteAudio);
      socket.off('force-disable-video', handleForceDisableVideo);
      socket.off('removed-from-meeting', handleRemovedFromMeeting);
      socket.off('cohost-status-changed', handleCohostStatusChanged);
      socket.off('participant-role-changed', handleParticipantRoleChanged);
      socket.off('participant-hand-toggled', handleParticipantHandToggled);
      socket.off('all-hands-lowered', handleAllHandsLowered);
      socket.off('participant-name-changed', handleParticipantNameChanged);
      socket.off('reaction-received', handleReactionReceived);
      socket.off('room-permissions-updated', handleRoomPermissionsUpdated);
      socket.off('peer-speaking-state', handlePeerSpeakingState);
      socket.off('peer-connection-state', handlePeerConnectionState);
      socket.off('error-notification', handleErrorNotification);

      socket.emit('leave-room');

      Object.keys(activePeers).forEach((key) => {
        removePeer(key);
      });
    };
  }, [socket, roomId, cleanRoomId, isInitializing, user, isHost, requiresWaitingRoom, createPeerConnection, removePeer, stopScreenShare, leaveCall]);

  // Host & Co-Host Action: Admit Participant from Waiting Room
  const admitParticipant = useCallback((targetSocketId) => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('admit-participant', { targetSocketId });
      setWaitingList((prev) => prev.filter((p) => p.socketId !== targetSocketId));
    }
  }, [socket, isHost, isCoHost]);

  // Host & Co-Host Action: Reject Participant from Waiting Room
  const rejectParticipant = useCallback((targetSocketId) => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('reject-participant', { targetSocketId });
      setWaitingList((prev) => prev.filter((p) => p.socketId !== targetSocketId));
    }
  }, [socket, isHost, isCoHost]);

  // Host & Co-Host Action: Lock / Unlock Meeting
  const toggleMeetingLock = useCallback(() => {
    if (socket && (isHost || isCoHost)) {
      const nextState = !isMeetingLocked;
      socket.emit('toggle-meeting-lock', { isLocked: nextState });
      setIsMeetingLocked(nextState);
    }
  }, [socket, isHost, isCoHost, isMeetingLocked]);

  // Host & Co-Host Action: Mute Participant
  const hostMuteParticipant = useCallback((targetSocketId) => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('host-mute-participant', { targetSocketId });
    }
  }, [socket, isHost, isCoHost]);

  // Host & Co-Host Action: Disable Participant Video
  const hostDisableVideo = useCallback((targetSocketId) => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('host-disable-video', { targetSocketId });
    }
  }, [socket, isHost, isCoHost]);

  // Host & Co-Host Action: Remove Participant
  const hostRemoveParticipant = useCallback((targetSocketId, reason = 'Removed by meeting host') => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('host-remove-participant', { targetSocketId, reason });
    }
  }, [socket, isHost, isCoHost]);

  // Main Host Action: Promote Participant to Co-Host
  const hostPromoteCoHost = useCallback((targetSocketId) => {
    if (socket && isHost) {
      socket.emit('host-promote-cohost', { targetSocketId });
    }
  }, [socket, isHost]);

  // Main Host Action: Revoke Co-Host
  const hostRevokeCoHost = useCallback((targetSocketId) => {
    if (socket && isHost) {
      socket.emit('host-revoke-cohost', { targetSocketId });
    }
  }, [socket, isHost]);

  // Host & Co-Host Action: Update Room-Wide Permissions
  const hostUpdateRoomPermissions = useCallback((updatedPerms) => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('host-update-room-permissions', { permissions: updatedPerms });
      setRoomPermissions((prev) => ({ ...prev, ...updatedPerms }));
    }
  }, [socket, isHost, isCoHost]);

  // Host & Co-Host Action: Lower All Hands
  const hostLowerAllHands = useCallback(() => {
    if (socket && (isHost || isCoHost)) {
      socket.emit('lower-all-hands');
      setIsHandRaised(false);
    }
  }, [socket, isHost, isCoHost]);

  // Participant or Host: Lower a specific participant's hand
  const lowerParticipantHand = useCallback((targetSocketId) => {
    if (!socket) return;
    socket.emit('lower-hand', { targetSocketId });
    if (targetSocketId === socket.id) {
      setIsHandRaised(false);
    }
  }, [socket]);

  // Participant: Toggle Raise Hand
  const toggleRaiseHand = useCallback(() => {
    if (!socket) return;
    const nextState = !isHandRaised;
    if (nextState) {
      socket.emit('raise-hand');
    } else {
      socket.emit('lower-hand', {});
    }
    setIsHandRaised(nextState);
  }, [socket, isHandRaised]);

  // Participant: Change Display Name
  const changeDisplayName = useCallback((newName) => {
    if (!socket || !newName?.trim()) return;
    if (roomPermissions?.allowNameChange === false && !isHost && !isCoHost) {
      alert('The meeting host has disabled name changes for participants.');
      return;
    }
    socket.emit('change-display-name', { newName: newName.trim() });
    setDisplayName(newName.trim());
  }, [socket, roomPermissions, isHost, isCoHost]);

  // Send Floating Emoji Reaction
  const sendReaction = useCallback((emoji) => {
    if (!socket || !emoji) return;
    socket.emit('send-reaction', { emoji });
  }, [socket]);

  // Dismiss Temporary Notice
  const dismissParticipantNotice = useCallback(() => {
    setParticipantNotice(null);
  }, []);

  // Toggle Audio (Mute / Unmute)
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        if (nextState && roomPermissions?.allowParticipantUnmute === false && !isHost && !isCoHost) {
          alert('The host has muted participants and restricted unmuting.');
          return;
        }
        audioTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsAudioMuted(!nextState);

        if (socket) {
          socket.emit('toggle-media', {
            kind: 'audio',
            enabled: nextState
          });
        }
      }
    }
  }, [socket, roomPermissions, isHost, isCoHost]);

  // Toggle Video (Camera on / off) - seamlessly upgrades Voice Call to Video Call
  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const currentTrack = videoTracks[0];

      // Turning video ON
      if (isVideoOff) {
        if (roomPermissions?.allowParticipantVideo === false && !isHost && !isCoHost) {
          alert('The host has restricted video cameras for participants.');
          return;
        }

        // If the current video track is a canvas/fallback track or missing, request real camera
        const isCanvasTrack = !currentTrack || currentTrack.label.toLowerCase().includes('canvas') || !currentTrack.label;
        if (isCanvasTrack) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
              }
            });
            const realVideoTrack = camStream.getVideoTracks()[0];
            if (realVideoTrack) {
              if (currentTrack) {
                localStreamRef.current.removeTrack(currentTrack);
                currentTrack.stop();
              }
              localStreamRef.current.addTrack(realVideoTrack);
              // Replace track in peer connections
              Object.values(peersRef.current).forEach((pc) => {
                pc.getSenders().forEach((sender) => {
                  if (sender.track && sender.track.kind === 'video') {
                    sender.replaceTrack(realVideoTrack).catch(() => {});
                  }
                });
              });
              setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }
          } catch (camErr) {
            console.warn('Could not acquire camera for video call:', camErr.message);
            setDeviceError(`Camera error: ${camErr.message}`);
            return;
          }
        } else {
          currentTrack.enabled = true;
        }

        setIsVideoOff(false);
        if (socket) {
          socket.emit('toggle-media', {
            kind: 'video',
            enabled: true
          });
        }
      } else {
        // Turning video OFF
        if (currentTrack) {
          currentTrack.enabled = false;
        }
        setIsVideoOff(true);
        if (socket) {
          socket.emit('toggle-media', {
            kind: 'video',
            enabled: false
          });
        }
      }
    }
  }, [isVideoOff, roomPermissions, isHost, isCoHost, socket]);

  // Host Action: End Meeting for Everyone
  const endMeetingForAll = useCallback(() => {
    if (socket && isHost) {
      socket.emit('end-meeting-for-all');
      leaveCall();
    }
  }, [socket, isHost, leaveCall]);

  return {
    localStream,
    remoteStreams,
    screenStream,
    remoteScreenStream,
    presenter,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isInitializing,
    deviceError,
    retryMediaAccess,
    inWaitingRoom,
    waitingList,
    isMeetingLocked,
    meetingEndedNotice,
    participantCount,
    speakingPeers,
    activeSpeakerId,
    peerConnectionStates,
    audioOutputDevices,
    selectedAudioOutputId,
    setAudioOutputDevice,
    admitParticipant,
    rejectParticipant,
    toggleMeetingLock,
    endMeetingForAll,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    startScreenShare,
    stopScreenShare,
    hostStopScreenShare,
    leaveCall,
    // Participant Management Additions
    isCoHost,
    isHandRaised,
    displayName,
    roomPermissions,
    reactions,
    participantNotice,
    hostMuteParticipant,
    hostDisableVideo,
    hostRemoveParticipant,
    hostPromoteCoHost,
    hostRevokeCoHost,
    hostUpdateRoomPermissions,
    hostLowerAllHands,
    lowerParticipantHand,
    toggleRaiseHand,
    changeDisplayName,
    sendReaction,
    dismissParticipantNotice
  };
};
