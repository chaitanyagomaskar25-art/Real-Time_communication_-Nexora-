import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { useWebRTC } from '../hooks/useWebRTC';
import { meetingService } from '../services/meetingService';
import { messageService } from '../services/messageService';
import VideoGrid from '../components/video/VideoGrid';
import PresentationView from '../components/video/PresentationView';
import WhatsAppCallView from '../components/video/WhatsAppCallView';
import ScreenShareToolbar from '../components/video/ScreenShareToolbar';
import ControlsBar from '../components/video/ControlsBar';
import ChatPanel from '../components/chat/ChatPanel';
import ParticipantList from '../components/room/ParticipantList';
import FileSharePanel from '../components/files/FileSharePanel';
import Whiteboard from '../components/whiteboard/Whiteboard';
import NotesPanel from '../components/notes/NotesPanel';
import PollsPanel from '../components/polls/PollsPanel';
import BreakoutModal from '../components/breakout/BreakoutModal';
import RecordingConsentModal from '../components/recording/RecordingConsentModal';
import TranscriptPanel from '../components/ai/TranscriptPanel';
import AIInsightsModal from '../components/ai/AIInsightsModal';
import RoomInfoModal from '../components/room/RoomInfoModal';
import WaitingRoom from '../components/room/WaitingRoom';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { recordingService } from '../services/recordingService';
import { StreamComposer } from '../utils/streamComposer';
import { AlertCircle, Clock, Lock, Shield, ArrowLeft, FolderUp, Crown, X, Phone, Video } from 'lucide-react';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const convId = searchParams.get('convId') || '';
  const callType = searchParams.get('callType') || '';
  const isAudioOnlyParam = searchParams.get('audioOnly') === 'true' || callType === 'voice';

  const cleanRoomId = (roomId || '').toLowerCase().trim();
  const effectiveConvId =
    convId ||
    (cleanRoomId.startsWith('dm-') ? cleanRoomId : '') ||
    (cleanRoomId.startsWith('voice-')
      ? cleanRoomId.replace(/^voice-/, 'dm-')
      : '');

  const isWhatsAppCallMode =
    isAudioOnlyParam ||
    callType === 'video' ||
    Boolean(effectiveConvId) ||
    cleanRoomId.startsWith('dm-') ||
    cleanRoomId.startsWith('voice-');

  const { socket } = useSocket();
  const { user } = useAuth();

  const [roomDetails, setRoomDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isPollsOpen, setIsPollsOpen] = useState(false);
  const [isBreakoutOpen, setIsBreakoutOpen] = useState(false);
  const [activeSubRoom, setActiveSubRoom] = useState(null);
  const [breakoutNotice, setBreakoutNotice] = useState(null);
  const [files, setFiles] = useState([]);
  const [unseenFilesCount, setUnseenFilesCount] = useState(0);
  const [fileToast, setFileToast] = useState(null);
  const [recordingToast, setRecordingToast] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);

  // Meeting Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [recordingHostName, setRecordingHostName] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const composerRef = React.useRef(null);

  // Live AI Transcription & Insights states
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState(null);

  // Video Layout state ('grid' | 'speaker' | 'gallery') and Pin state
  const [layout, setLayout] = useState('grid');
  const [pinnedPeerId, setPinnedPeerId] = useState(null);

  // Access validation states
  const [accessPassword, setAccessPassword] = useState(location.state?.password || '');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isAccessValidated, setIsAccessValidated] = useState(false);
  const [validationInfo, setValidationInfo] = useState({ isHost: false, requiresWaitingRoom: false });

  // Validate access on mount
  useEffect(() => {
    let isMounted = true;

    // If this call was already ended in this browser session, immediately redirect
    if (sessionStorage.getItem(`ended_call_${cleanRoomId}`) === 'true' || localStorage.getItem(`ended_call_${cleanRoomId}`) === 'true') {
      const returnUrl = effectiveConvId
        ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
        : '/dashboard?view=messages';
      navigate(returnUrl, { replace: true });
      return;
    }

    const validate = async () => {
      try {
        const result = await meetingService.validateMeetingAccess(cleanRoomId, accessPassword);

        if (result.requiresPassword) {
          if (isMounted) setIsPasswordModalOpen(true);
          return;
        }

        if (isMounted) {
          setValidationInfo({
            isHost: Boolean(result.isHost),
            requiresWaitingRoom: Boolean(result.requiresWaitingRoom)
          });
          setRoomDetails(result.meeting);
          setIsAccessValidated(true);
        }
      } catch (err) {
        if (isMounted) {
          sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
          localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
          const returnUrl = effectiveConvId
            ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
            : '/dashboard?view=messages';
          navigate(returnUrl, { replace: true });
        }
      }
    };

    validate();

    return () => {
      isMounted = false;
    };
  }, [cleanRoomId, accessPassword, effectiveConvId, navigate]);

  // Handle password submit if required
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    try {
      const result = await meetingService.validateMeetingAccess(cleanRoomId, accessPassword);
      if (result.requiresPassword) {
        setPasswordError('Password required');
        return;
      }

      setValidationInfo({
        isHost: Boolean(result.isHost),
        requiresWaitingRoom: Boolean(result.requiresWaitingRoom)
      });
      setRoomDetails(result.meeting);
      setIsPasswordModalOpen(false);
      setIsAccessValidated(true);
    } catch (err) {
      setPasswordError(err.message || 'Incorrect meeting password.');
    }
  };

  // WebRTC Hook
  const {
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
  } = useWebRTC(isAccessValidated ? socket : null, cleanRoomId, user, {
    isHost: validationInfo.isHost,
    requiresWaitingRoom: validationInfo.requiresWaitingRoom,
    isLocked: roomDetails?.settings?.isLocked,
    audioOnly: isAudioOnlyParam
  });

  // Auto switch layout to 'presentation' when screen share starts
  useEffect(() => {
    if (screenStream || remoteScreenStream || presenter) {
      setLayout('presentation');
    } else {
      setLayout((prev) => (prev === 'presentation' ? 'grid' : prev));
    }
  }, [screenStream, remoteScreenStream, presenter]);

  // Call duration timer
  useEffect(() => {
    if (inWaitingRoom) return;
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [inWaitingRoom]);

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load initial chat history when admitted to the room
  useEffect(() => {
    if (!isAccessValidated || inWaitingRoom) return;
    let isMounted = true;

    const fetchInitialChat = async () => {
      try {
        const res = await meetingService.getMeetingMessages(roomId, { page: 1, limit: 30 });
        const list = res?.data?.messages || res?.messages;
        const pagination = res?.data?.pagination || res?.pagination;
        if (isMounted && res?.success && list) {
          setMessages(list);
          setHasMoreMessages(Boolean(pagination?.hasMore));
          setMessagePage(1);
        }
      } catch (err) {
        console.warn('Could not load chat history:', err.message);
      }
    };

    fetchInitialChat();

    return () => {
      isMounted = false;
    };
  }, [roomId, isAccessValidated, inWaitingRoom]);

  // Load shared files history for the meeting
  useEffect(() => {
    if (!isAccessValidated || inWaitingRoom) return;
    let isMounted = true;

    const fetchInitialFiles = async () => {
      try {
        const res = await meetingService.getMeetingFiles(roomId);
        const list = res?.data?.files || res?.files;
        if (isMounted && res?.success && list) {
          setFiles(list);
        }
      } catch (err) {
        console.warn('Could not load shared files:', err.message);
      }
    };

    fetchInitialFiles();

    return () => {
      isMounted = false;
    };
  }, [roomId, isAccessValidated, inWaitingRoom]);

  // Socket file-sharing event bindings
  useEffect(() => {
    if (!socket || inWaitingRoom) return;

    const handleNewFileShared = ({ files: newFiles, uploader }) => {
      setFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.fileId || f.id));
        const toAdd = (newFiles || []).filter((f) => !existingIds.has(f.fileId || f.id));
        return [...toAdd, ...prev];
      });

      if (!isFilesOpen) {
        setUnseenFilesCount((prev) => prev + (newFiles?.length || 1));
        setFileToast({
          uploader: uploader || 'A participant',
          count: newFiles?.length || 1,
          firstFileName: newFiles?.[0]?.originalName || 'file'
        });
        setTimeout(() => setFileToast(null), 5000);
      }
    };

    const handleFileDeleted = ({ fileId }) => {
      setFiles((prev) => prev.filter((f) => (f.fileId || f.id) !== fileId));
    };

    socket.on('new-file-shared', handleNewFileShared);
    socket.on('file-deleted', handleFileDeleted);

    return () => {
      socket.off('new-file-shared', handleNewFileShared);
      socket.off('file-deleted', handleFileDeleted);
    };
  }, [socket, isFilesOpen, inWaitingRoom]);

  // Live Recording socket events & consent flow
  useEffect(() => {
    if (!socket || inWaitingRoom) return;

    const handleRecordingStarted = ({ recordingId: recId, hostName }) => {
      setIsRecording(true);
      if (recId) setRecordingId(recId);
      if (hostName) setRecordingHostName(hostName);

      // Show consent prompt if not host and hasn't consented yet
      if (!validationInfo.isHost && !hasConsented) {
        setIsConsentModalOpen(true);
      }
    };

    const handleRecordingStopped = () => {
      setIsRecording(false);
      setRecordingDuration(0);
      setIsConsentModalOpen(false);
    };

    socket.on('recording-started', handleRecordingStarted);
    socket.on('recording-stopped', handleRecordingStopped);

    return () => {
      socket.off('recording-started', handleRecordingStarted);
      socket.off('recording-stopped', handleRecordingStopped);
    };
  }, [socket, inWaitingRoom, validationInfo.isHost, hasConsented]);

  // Recording duration timer
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Live AI Transcription status listener
  useEffect(() => {
    if (!socket || inWaitingRoom) return;

    const handleTranscriptionStatus = ({ isTranscribing: active, message, hostName }) => {
      setIsTranscribing(Boolean(active));
      if (active) {
        setTranscriptionNotice({ message, hostName });
      } else {
        setTranscriptionNotice(null);
      }
    };

    socket.on('transcription-status-changed', handleTranscriptionStatus);
    return () => {
      socket.off('transcription-status-changed', handleTranscriptionStatus);
    };
  }, [socket, inWaitingRoom]);

  // Handle loading older messages (pagination)
  const handleLoadOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreMessages) return;
    setIsLoadingOlder(true);
    try {
      const nextPage = messagePage + 1;
      const res = await meetingService.getMeetingMessages(roomId, { page: nextPage, limit: 30 });
      const list = res?.data?.messages || res?.messages;
      const pagination = res?.data?.pagination || res?.pagination;
      if (res?.success && list) {
        setMessages((prev) => [...list, ...prev]);
        setMessagePage(nextPage);
        setHasMoreMessages(Boolean(pagination?.hasMore));
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Socket chat event bindings
  useEffect(() => {
    if (!socket || inWaitingRoom) return;

    const handleNewMessage = (message) => {
      setMessages((prev) => {
        const id = message.id || message._id;
        if (prev.some((m) => (m.id || m._id) === id)) return prev;
        return [...prev, message];
      });
      if (!isChatOpen) {
        setUnreadMessages((prev) => prev + 1);
      }
    };

    const handleMessageEdited = ({ messageId, newContent, isEdited }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if ((m.id || m._id) === messageId) {
            return { ...m, content: newContent, isEdited: Boolean(isEdited) };
          }
          return m;
        })
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if ((m.id || m._id) === messageId) {
            return { ...m, isDeleted: true, content: 'This message was deleted' };
          }
          return m;
        })
      );
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if ((m.id || m._id) === messageId) {
            return { ...m, reactions };
          }
          return m;
        })
      );
    };

    const handleUserTyping = ({ userId, userName, isTyping, isPrivate }) => {
      setTypingUsers((prev) => {
        const remaining = prev.filter((u) => u.userId !== userId);
        if (isTyping) {
          return [...remaining, { userId, userName, isPrivate }];
        }
        return remaining;
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('reaction-updated', handleReactionUpdated);
    socket.on('user-typing', handleUserTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('reaction-updated', handleReactionUpdated);
      socket.off('user-typing', handleUserTyping);
    };
  }, [socket, isChatOpen, inWaitingRoom]);

  // Breakout rooms live listeners
  useEffect(() => {
    if (!socket) return;

    const handleBreakoutAnnouncement = (data) => {
      setBreakoutNotice(data);
      setTimeout(() => setBreakoutNotice(null), 6000);
    };

    const handleBreakoutClosed = () => {
      setActiveSubRoom(null);
      setBreakoutNotice({
        message: 'Breakout rooms were closed by the host. Returned to main room.',
        senderName: 'System'
      });
      setTimeout(() => setBreakoutNotice(null), 5000);
    };

    socket.on('breakout-announcement', handleBreakoutAnnouncement);
    socket.on('breakout-rooms-closed', handleBreakoutClosed);

    return () => {
      socket.off('breakout-announcement', handleBreakoutAnnouncement);
      socket.off('breakout-rooms-closed', handleBreakoutClosed);
    };
  }, [socket]);

  const handleSendMessage = async (payload) => {
    if (!socket) return;
    let finalPayload = { ...payload };

    // Upload attachment to Cloudinary if user attached a file
    if (payload.file && typeof payload.file !== 'string' && (payload.file instanceof Blob || payload.file.size !== undefined)) {
      try {
        const uploadRes = await messageService.uploadAttachment(payload.file, roomId);
        if (uploadRes && uploadRes.url) {
          finalPayload.file = {
            name: uploadRes.name || payload.file.name,
            size: uploadRes.size || payload.file.size,
            type: uploadRes.type || payload.file.type,
            url: uploadRes.url,
            storageProvider: uploadRes.storageProvider || 'cloudinary'
          };
        }
      } catch (uploadErr) {
        console.warn('Failed to upload meeting chat file to Cloudinary:', uploadErr);
      }
    }

    socket.emit('send-message', finalPayload);
  };

  const handleEditMessage = (messageId, newContent) => {
    if (socket) {
      socket.emit('edit-message', { messageId, newContent });
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (socket) {
      socket.emit('delete-message', { messageId });
    }
  };

  const handleReaction = (messageId, emoji) => {
    if (socket) {
      socket.emit('message-reaction', { messageId, emoji });
    }
  };

  const handleTyping = (isTyping, recipientSocketId) => {
    if (socket) {
      socket.emit('typing', { isTyping, recipientSocketId });
    }
  };

  const handleLeaveCall = () => {
    sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
    localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
    try {
      socket?.emit('end-meeting-for-all');
    } catch {}
    leaveCall();

    const returnUrl = effectiveConvId
      ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
      : '/dashboard?view=messages';
    navigate(returnUrl, { replace: true });
  };

  const handleReturnToChat = () => {
    sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
    localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
    try {
      socket?.emit('end-meeting-for-all');
    } catch {}
    leaveCall();

    const returnUrl = effectiveConvId
      ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
      : '/dashboard?view=messages';
    navigate(returnUrl, { replace: true });
  };

  // Handle browser back button (popstate): cut call, clean up, and replace history
  useEffect(() => {
    const handlePopState = () => {
      sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      try {
        socket?.emit('end-meeting-for-all');
      } catch {}
      leaveCall();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [cleanRoomId, socket, leaveCall]);

  // If remote peer disconnected in a 1-on-1 WhatsApp call, end the call and return to chat
  const hasRemoteConnectedRef = useRef(false);
  useEffect(() => {
    if (Object.keys(remoteStreams).length > 0) {
      hasRemoteConnectedRef.current = true;
    } else if (hasRemoteConnectedRef.current && isWhatsAppCallMode) {
      sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      leaveCall();
      const returnUrl = effectiveConvId
        ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
        : '/dashboard?view=messages';
      navigate(returnUrl, { replace: true });
    }
  }, [remoteStreams, isWhatsAppCallMode, cleanRoomId, effectiveConvId, leaveCall, navigate]);

  // When meeting/call is ended by host or other peer, auto-redirect back to chat
  useEffect(() => {
    if (meetingEndedNotice) {
      sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      localStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
      leaveCall();
      const timer = setTimeout(() => {
        const returnUrl = effectiveConvId
          ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
          : '/dashboard?view=messages';
        navigate(returnUrl, { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [meetingEndedNotice, cleanRoomId, effectiveConvId, leaveCall, navigate]);

  // Auto-dismiss recording notification after 5 seconds
  useEffect(() => {
    if (!recordingToast) return;
    const timer = setTimeout(() => {
      setRecordingToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [recordingToast]);

  // Host Toggle Recording (Start / Stop)
  const handleToggleRecording = async () => {
    if (!isRecording) {
      try {
        const composer = new StreamComposer();
        composerRef.current = composer;
        composer.start({
          localStream,
          remoteStreams,
          presentationStream: screenStream || remoteScreenStream
        });

        if (socket) {
          socket.emit('recording-start', { meetingId: roomId }, (res) => {
            if (res?.recording?.recordingId) {
              setRecordingId(res.recording.recordingId);
            }
          });
        }
        setIsRecording(true);
        setHasConsented(true);
      } catch (err) {
        console.warn('Browser StreamComposer fallback to socket signaling:', err);
        if (socket) {
          socket.emit('recording-start', { meetingId: roomId }, (res) => {
            if (res?.recording?.recordingId) {
              setRecordingId(res.recording.recordingId);
            }
          });
        }
        setIsRecording(true);
        setHasConsented(true);
      }
    } else {
      setIsRecording(false);
      const currentRecId = recordingId;
      const currentDuration = recordingDuration;

      if (socket) {
        socket.emit('recording-stop', {
          meetingId: roomId,
          recordingId: currentRecId,
          duration: currentDuration
        });
      }

      // Ensure backend transitions status to ready even if upload is processing
      recordingService.stopRecording(roomId, {
        recordingId: currentRecId,
        duration: currentDuration
      }).catch(() => {});

      if (composerRef.current) {
        try {
          const { blob, duration } = await composerRef.current.stop();
          if (blob && blob.size > 0) {
            const formData = new FormData();
            formData.append('recording', blob, `meeting_${roomId}.webm`);
            formData.append('recordingId', currentRecId || `rec_${Date.now()}`);
            formData.append('duration', duration || currentDuration || 1);

            await recordingService.uploadRecording(roomId, formData);
            setRecordingToast({
              type: 'success',
              message: 'Meeting recording successfully saved to your library!'
            });
          } else {
            setRecordingToast({
              type: 'success',
              message: 'Recording ended and saved.'
            });
          }
        } catch (uploadErr) {
          console.warn('Recording upload failed:', uploadErr);
          setRecordingToast({
            type: 'error',
            message: uploadErr?.message || 'Recording upload failed'
          });
        } finally {
          composerRef.current = null;
        }
      } else {
        setRecordingToast({
          type: 'success',
          message: 'Recording session ended.'
        });
      }
    }
  };

  const handleConsent = () => {
    setHasConsented(true);
    setIsConsentModalOpen(false);
    if (socket && recordingId) {
      socket.emit('recording-consent', { recordingId, consented: true });
    }
    if (recordingId) {
      recordingService.recordConsent(recordingId, { meetingId: roomId }).catch(() => {});
    }
  };

  const handleLeaveFromConsent = () => {
    setIsConsentModalOpen(false);
    sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
    leaveCall();
    const returnUrl = effectiveConvId
      ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
      : '/dashboard?view=messages';
    navigate(returnUrl, { replace: true });
  };

  const handleToggleTranscription = () => {
    if (!socket) return;
    socket.emit('transcription-toggle', {
      meetingId: roomId,
      enabled: !isTranscribing
    });
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => !prev);
    if (!isChatOpen) {
      setUnreadMessages(0);
      setIsParticipantsOpen(false);
      setIsFilesOpen(false);
    }
  };

  const handleToggleParticipants = () => {
    setIsParticipantsOpen((prev) => !prev);
    if (!isParticipantsOpen) {
      setIsChatOpen(false);
      setIsFilesOpen(false);
    }
  };

  const handleToggleFiles = () => {
    setIsFilesOpen((prev) => !prev);
    if (!isFilesOpen) {
      setUnseenFilesCount(0);
      setIsChatOpen(false);
      setIsParticipantsOpen(false);
    }
  };

  const handleUploadFiles = async (formData, onProgress) => {
    const res = await meetingService.uploadMeetingFiles(roomId, formData, onProgress);
    const uploaded = res?.data?.files || res?.files;
    if (uploaded && uploaded.length > 0) {
      setFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.fileId || f.id));
        const toAdd = uploaded.filter((f) => !existingIds.has(f.fileId || f.id));
        return [...toAdd, ...prev];
      });
    }
    return res;
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await meetingService.deleteMeetingFile(roomId, fileId);
      setFiles((prev) => prev.filter((f) => (f.fileId || f.id) !== fileId));
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete file');
    }
  };

  // If meeting ended for all
  if (meetingEndedNotice) {
    const returnUrl = effectiveConvId
      ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}`
      : '/dashboard?view=messages';

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">{meetingEndedNotice}</h2>
          <p className="text-xs text-slate-400">The call has ended.</p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              sessionStorage.setItem(`ended_call_${cleanRoomId}`, 'true');
              leaveCall();
              navigate(returnUrl, { replace: true });
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Chat
          </Button>
        </div>
      </div>
    );
  }

  // If access is not validated yet (awaiting verification or password prompt)
  if (!isAccessValidated) {
    if (isPasswordModalOpen) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
          <Modal
            isOpen={isPasswordModalOpen}
            onClose={() => navigate(effectiveConvId ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}` : '/dashboard', { replace: true })}
            title="Password Protected Meeting"
            subtitle="This meeting requires a password to enter"
          >
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 rounded-xl">
                  {passwordError}
                </div>
              )}
              <Input
                label="Meeting Password"
                type="password"
                placeholder="Enter password..."
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                required
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => navigate(effectiveConvId ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}` : '/dashboard', { replace: true })}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Unlock & Join
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Verifying meeting access...</p>
        </div>
      </div>
    );
  }

  // If placed in waiting room
  if (inWaitingRoom) {
    return (
      <WaitingRoom
        meetingTitle={roomDetails?.title}
        hostName={roomDetails?.hostName}
        onLeave={handleLeaveCall}
      />
    );
  }

  const currentUserName = displayName || user?.fullName || user?.name || 'You';
  const remoteEntries = Object.entries(remoteStreams);

  const allParticipants = [
    {
      id: 'local',
      stream: localStream,
      userName: currentUserName,
      isLocal: true,
      isMuted: isAudioMuted,
      isVideoOff,
      isSpeaking: Boolean(speakingPeers.local),
      connectionState: 'connected',
      isHandRaised: Boolean(isHandRaised),
      role: validationInfo.isHost ? 'host' : isCoHost ? 'co-host' : 'participant',
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-dark-950 flex flex-col justify-between overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 bg-dark-900/60 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 transition-all cursor-pointer shadow-sm hover:shadow group shrink-0"
            title={effectiveConvId ? 'Leave call and return to Chat' : 'Leave room and return to Dashboard'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">{effectiveConvId ? 'Back to Chat' : 'Back to Dashboard'}</span>
            <span className="sm:hidden">{effectiveConvId ? 'Chat' : 'Dashboard'}</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-white tracking-wide truncate max-w-xs sm:max-w-md">
            {roomDetails?.title || 'NEXORA Conference'}
          </h2>
          <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded hidden sm:inline-block">
            {roomId}
          </span>
          {isAudioOnlyParam && (
            <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
              <Phone className="w-3 h-3 text-sky-400" />
              Voice Call
            </span>
          )}
          {!isAudioOnlyParam && isWhatsAppCallMode && (
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
              <Video className="w-3 h-3 text-emerald-400" />
              Video Call
            </span>
          )}
          {validationInfo.isHost ? (
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-400" />
              Host
            </span>
          ) : isCoHost ? (
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
              <Shield className="w-3 h-3 text-indigo-400" />
              Co-Host
            </span>
          ) : null}
          {isMeetingLocked && (
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Locked
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-lg animate-pulse shadow-sm shadow-rose-500/20 font-sans">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-[11px] font-bold tracking-wide">REC</span>
              <span className="font-mono text-[11px]">{formatDuration(recordingDuration)}</span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-semibold tracking-wide">P2P Mesh Live</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDuration(callDuration)}</span>
          </div>
        </div>
      </div>

      {/* Live Audio Transcription Notice Banner */}
      {transcriptionNotice && (
        <div className="bg-brand-600/90 text-white px-4 py-1.5 text-xs flex items-center justify-between z-30 animate-fade-in shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-semibold">{transcriptionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTranscriptionNotice(null)}
            className="p-0.5 rounded hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Device Warning Notice */}
      {deviceError && !isWhatsAppCallMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-300 flex items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Microphone / Camera access: {deviceError}. Check your browser permissions (🔒 icon in address bar) if you wish to enable hardware access.
            </span>
          </div>
          <button
            onClick={retryMediaAccess}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-xs transition shrink-0 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Screen Sharing Notification & Control Toolbar */}
      {(isScreenSharing || presenter || remoteScreenStream) && (
        <ScreenShareToolbar
          isLocalPresenting={isScreenSharing}
          presenterName={isScreenSharing ? 'You' : presenter?.userName || 'Presenter'}
          presenterSocketId={presenter?.socketId}
          onStopSharing={toggleScreenShare}
          isHost={validationInfo.isHost}
          onHostStopSharing={hostStopScreenShare}
        />
      )}

      {/* Central Video Grid / Presentation / Whiteboard View */}
      <div className="flex-1 flex items-center justify-center relative p-2 sm:p-4">
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-300">Setting up your media stream...</p>
          </div>
        ) : isWhiteboardActive ? (
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex flex-col">
            <Whiteboard
              meetingId={roomId}
              socket={socket}
              currentUser={user}
              isHost={validationInfo.isHost || isCoHost}
              onClose={() => setIsWhiteboardActive(false)}
            />
          </div>
        ) : (layout === 'presentation' && (screenStream || remoteScreenStream)) ? (
          <PresentationView
            screenStream={screenStream || remoteScreenStream}
            presenterName={isScreenSharing ? 'You' : presenter?.userName || 'Presenter'}
            isLocalPresenting={isScreenSharing}
            participants={allParticipants}
            speakingPeers={speakingPeers}
            activeSpeakerId={activeSpeakerId}
            peerConnectionStates={peerConnectionStates}
            audioOutputDeviceId={selectedAudioOutputId}
            pinnedPeerId={pinnedPeerId}
            onPinPeer={(id) => setPinnedPeerId((prev) => (prev === id ? null : id))}
          />
        ) : isWhatsAppCallMode ? (
          <WhatsAppCallView
            isAudioOnly={isAudioOnlyParam}
            localStream={localStream}
            remoteStreams={remoteStreams}
            userName={currentUserName}
            peerName={roomDetails?.title?.replace(/ (Voice|Video) Call$/i, '') || 'Participant'}
            callDuration={callDuration}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            speakingPeers={speakingPeers}
            activeSpeakerId={activeSpeakerId}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onLeaveCall={handleLeaveCall}
            onToggleChat={handleReturnToChat}
            unreadCount={unreadMessages}
            deviceError={deviceError}
            onRetryMedia={retryMediaAccess}
            audioOutputDevices={audioOutputDevices}
            selectedAudioOutputId={selectedAudioOutputId}
            onSelectAudioOutput={setAudioOutputDevice}
          />
        ) : (
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            userName={currentUserName}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            speakingPeers={speakingPeers}
            activeSpeakerId={activeSpeakerId}
            peerConnectionStates={peerConnectionStates}
            audioOutputDeviceId={selectedAudioOutputId}
            layout={layout}
            pinnedPeerId={pinnedPeerId}
            onPinPeer={(id) => setPinnedPeerId((prev) => (prev === id ? null : id))}
            isHost={validationInfo.isHost}
            isCoHost={isCoHost}
            isHandRaised={isHandRaised}
          />
        )}
      </div>

      {/* Floating Animated Live Emoji Reactions */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((react) => (
          <div
            key={react.id}
            style={{ left: `${react.leftPercent}%` }}
            className="absolute bottom-28 transform -translate-x-1/2 flex flex-col items-center animate-float-up pointer-events-none"
          >
            <div className="text-4xl sm:text-5xl drop-shadow-xl select-none">{react.emoji}</div>
            <span className="text-[10px] font-semibold text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full mt-1 border border-white/10 shadow-md">
              {react.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Temporary Participant Notice Toast (Muted, Disabled Video, Promoted, etc.) */}
      {participantNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              participantNotice.type === 'warning'
                ? 'bg-amber-600/95 text-white border-amber-400/50'
                : participantNotice.type === 'error'
                ? 'bg-rose-600/95 text-white border-rose-400/50'
                : 'bg-indigo-600/95 text-white border-indigo-400/50'
            }`}
          >
            <span>{participantNotice.message}</span>
            <button
              onClick={dismissParticipantNotice}
              className="p-0.5 rounded hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Controls Bar (Hidden in dedicated WhatsApp call mode) */}
      {!isWhatsAppCallMode && (
        <ControlsBar
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleChat={handleToggleChat}
          onToggleParticipants={handleToggleParticipants}
          onToggleFiles={handleToggleFiles}
          onToggleWhiteboard={() => setIsWhiteboardActive((prev) => !prev)}
          onToggleInfo={() => setIsInfoModalOpen(true)}
          onLeaveCall={handleLeaveCall}
          onEndCallForAll={endMeetingForAll}
          isChatOpen={isChatOpen}
          isParticipantsOpen={isParticipantsOpen}
          isFilesOpen={isFilesOpen}
          isWhiteboardActive={isWhiteboardActive}
          unreadCount={unreadMessages}
          unseenFilesCount={unseenFilesCount}
          participantCount={participantCount}
          isHost={validationInfo.isHost}
          isMeetingLocked={isMeetingLocked}
          waitingCount={waitingList.length}
          layout={layout}
          onChangeLayout={setLayout}
          audioOutputDevices={audioOutputDevices}
          selectedAudioOutputId={selectedAudioOutputId}
          onSelectAudioOutput={setAudioOutputDevice}
          isHandRaised={isHandRaised}
          onToggleRaiseHand={toggleRaiseHand}
          onSendReaction={sendReaction}
          isNotesOpen={isNotesOpen}
          onToggleNotes={() => {
            setIsNotesOpen((prev) => !prev);
            setIsPollsOpen(false);
            setIsChatOpen(false);
            setIsParticipantsOpen(false);
            setIsFilesOpen(false);
          }}
          isPollsOpen={isPollsOpen}
          onTogglePolls={() => {
            setIsPollsOpen((prev) => !prev);
            setIsNotesOpen(false);
            setIsChatOpen(false);
            setIsParticipantsOpen(false);
            setIsFilesOpen(false);
          }}
          onToggleBreakout={() => setIsBreakoutOpen(true)}
          isCoHost={isCoHost}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          recordingDuration={recordingDuration}
          isTranscriptOpen={isTranscriptOpen}
          onToggleTranscript={() => {
            setIsTranscriptOpen((prev) => !prev);
            setIsChatOpen(false);
            setIsParticipantsOpen(false);
            setIsFilesOpen(false);
            setIsNotesOpen(false);
            setIsPollsOpen(false);
          }}
          onToggleInsights={() => setIsInsightsOpen((prev) => !prev)}
          isTranscribing={isTranscribing}
        />
      )}

      {/* Participant Recording Consent Modal */}
      <RecordingConsentModal
        isOpen={isConsentModalOpen}
        hostName={recordingHostName}
        onConsent={handleConsent}
        onLeave={handleLeaveFromConsent}
      />

      {/* Breakout Announcement Toast */}
      {breakoutNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-2 text-xs">
            <span>📢 {breakoutNotice.senderName}:</span>
            <span>{breakoutNotice.message}</span>
          </div>
        </div>
      )}

      {/* Shared Meeting Notes Drawer */}
      <NotesPanel
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        roomId={roomId}
        socket={socket}
        currentUser={user}
      />

      {/* Live Meeting Polls Drawer */}
      <PollsPanel
        isOpen={isPollsOpen}
        onClose={() => setIsPollsOpen(false)}
        roomId={roomId}
        socket={socket}
        currentUser={user}
        isHost={validationInfo.isHost}
        isCoHost={isCoHost}
      />

      {/* Breakout Rooms Modal */}
      <BreakoutModal
        isOpen={isBreakoutOpen}
        onClose={() => setIsBreakoutOpen(false)}
        roomId={roomId}
        socket={socket}
        currentUser={user}
        isHost={validationInfo.isHost}
        isCoHost={isCoHost}
        activeSubRoom={activeSubRoom}
        onJoinSubRoom={(subRoomId) => setActiveSubRoom(subRoomId)}
      />

      {/* Floating Real-Time File Notification Toast */}
      {fileToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-bounce">
          <div className="px-4 py-2.5 bg-brand-600 text-white rounded-2xl shadow-2xl border border-brand-400/40 flex items-center gap-2.5 text-xs">
            <FolderUp className="w-4 h-4 shrink-0 text-white" />
            <span>
              <strong className="font-semibold">{fileToast.uploader}</strong> shared{' '}
              {fileToast.count > 1 ? `${fileToast.count} new files` : `"${fileToast.firstFileName}"`}
            </span>
            <button
              onClick={() => {
                setFileToast(null);
                setIsFilesOpen(true);
                setIsChatOpen(false);
                setIsParticipantsOpen(false);
                setUnseenFilesCount(0);
              }}
              className="ml-2 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-semibold transition cursor-pointer"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* Floating Recording Toast Notification */}
      {recordingToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              recordingToast.type === 'error'
                ? 'bg-rose-600/95 text-white border-rose-400/50'
                : 'bg-emerald-600/95 text-white border-emerald-400/50'
            }`}
          >
            <span>{recordingToast.message}</span>
            <button
              onClick={() => setRecordingToast(null)}
              className="p-0.5 rounded hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* In-Call Chat Drawer */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onReaction={handleReaction}
        onTyping={handleTyping}
        onLoadOlderMessages={handleLoadOlderMessages}
        hasMoreMessages={hasMoreMessages}
        isLoadingOlder={isLoadingOlder}
        currentUserId={user?.id || user?._id || socket?.id}
        currentUserName={currentUserName}
        participants={remoteEntries}
        typingUsers={typingUsers}
      />

      {/* File Sharing Drawer */}
      <FileSharePanel
        isOpen={isFilesOpen}
        onClose={() => setIsFilesOpen(false)}
        files={files}
        onUploadFiles={handleUploadFiles}
        onDeleteFile={handleDeleteFile}
        currentUserId={user?.id || user?._id || socket?.id}
        isHost={validationInfo.isHost}
        meetingId={roomId}
      />

      {/* Participant List Drawer with Host / Co-Host & Advanced Controls */}
      <ParticipantList
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        participants={remoteEntries}
        currentUserName={currentUserName}
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isHost={validationInfo.isHost}
        isCoHost={isCoHost}
        isHandRaised={isHandRaised}
        waitingList={waitingList}
        onAdmit={admitParticipant}
        onReject={rejectParticipant}
        isMeetingLocked={isMeetingLocked}
        onToggleLock={toggleMeetingLock}
        presenter={isScreenSharing ? { socketId: 'local', userName: currentUserName } : presenter}
        onHostStopScreenShare={hostStopScreenShare}
        roomPermissions={roomPermissions}
        onUpdateRoomPermissions={hostUpdateRoomPermissions}
        onMuteParticipant={hostMuteParticipant}
        onDisableVideo={hostDisableVideo}
        onRemoveParticipant={hostRemoveParticipant}
        onPromoteCoHost={hostPromoteCoHost}
        onRevokeCoHost={hostRevokeCoHost}
        onLowerParticipantHand={lowerParticipantHand}
        onLowerAllHands={hostLowerAllHands}
        onChangeDisplayName={changeDisplayName}
      />

      {/* Live AI Transcription Panel */}
      <TranscriptPanel
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        roomId={roomId}
        socket={socket}
        currentUser={user}
        isHost={validationInfo.isHost || isCoHost}
        isTranscribing={isTranscribing}
        onToggleTranscription={handleToggleTranscription}
      />

      {/* AI Meeting Insights & Action Items Modal */}
      <AIInsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        meetingId={roomId}
        isHost={validationInfo.isHost || isCoHost}
      />

      {/* Room Details Modal */}
      <RoomInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        roomId={roomId}
        roomTitle={roomDetails?.title}
      />

      {/* Password Prompt Modal if required */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => navigate(effectiveConvId ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}` : '/dashboard', { replace: true })}
        title="Password Protected Meeting"
        subtitle="This meeting requires a password to enter"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 rounded-xl">
              {passwordError}
            </div>
          )}
          <Input
            label="Meeting Password"
            type="password"
            placeholder="Enter password..."
            value={accessPassword}
            onChange={(e) => setAccessPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => navigate(effectiveConvId ? `/dashboard?view=messages&convId=${encodeURIComponent(effectiveConvId)}` : '/dashboard', { replace: true })}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Unlock & Join
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Room;
