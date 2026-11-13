import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Mic,
  MicOff,
  Download,
  X,
  Sparkles,
  Send,
  User,
  Clock
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import Button from '../common/Button';

const TranscriptPanel = ({
  isOpen,
  onClose,
  roomId,
  socket,
  currentUser,
  isTranscribing = false,
  onToggleTranscription,
  isHost = false
}) => {
  const [segments, setSegments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  // Load initial transcript
  useEffect(() => {
    if (!isOpen || !roomId) return;
    let isMounted = true;

    aiService.getTranscript(roomId).then((data) => {
      if (isMounted && data?.segments) {
        setSegments(data.segments);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId]);

  // Listen to live transcript segments via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleSegmentReceived = ({ meetingId, segment }) => {
      if (meetingId?.toLowerCase().trim() === roomId?.toLowerCase().trim() && segment) {
        setSegments((prev) => [...prev, segment]);
      }
    };

    socket.on('transcript-segment-received', handleSegmentReceived);
    return () => {
      socket.off('transcript-segment-received', handleSegmentReceived);
    };
  }, [socket, roomId]);

  // Auto-scroll to bottom on new segments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  // Web Speech API for in-browser microphone speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition && isRecognizing) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim();

        if (text && socket) {
          socket.emit('transcript-segment', {
            meetingId: roomId,
            text,
            startTime: Date.now()
          });
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Could not start recognition:', e);
      }
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Safe ignore
      }
      recognitionRef.current = null;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Safe ignore
        }
      }
    };
  }, [isRecognizing, roomId, socket]);

  const handleSendManual = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const text = manualInput.trim();
    setManualInput('');

    if (socket) {
      socket.emit('transcript-segment', {
        meetingId: roomId,
        text,
        startTime: Date.now()
      });
    } else {
      try {
        const seg = await aiService.appendSegment(roomId, { text });
        if (seg) setSegments((prev) => [...prev, seg]);
      } catch (err) {
        console.warn('Failed to append manual segment:', err);
      }
    }
  };

  const handleExport = () => {
    if (segments.length === 0) return;
    const lines = segments.map((s) => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.speakerName}: ${s.text}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSegments = segments.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.text?.toLowerCase().includes(q) || s.speakerName?.toLowerCase().includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Live Transcription
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {segments.length} dialogue segments recorded
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExport}
            title="Export Transcript"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Host Transcription Toggle & Mic Earphone Controls */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-dark-800/50 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              type="button"
              onClick={onToggleTranscription}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                isTranscribing
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                  : 'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isTranscribing ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'}`} />
              {isTranscribing ? 'Transcription Active' : 'Enable Transcription'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsRecognizing((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              isRecognizing
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                : 'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-slate-300'
            }`}
            title="Auto-convert microphone speech to text via browser Web Speech API"
          >
            {isRecognizing ? <Mic className="w-3 h-3 animate-pulse" /> : <MicOff className="w-3 h-3" />}
            {isRecognizing ? 'Auto-Mic On' : 'Voice-to-Text'}
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-dark-800 text-slate-900 dark:text-white rounded-xl text-xs border border-transparent focus:border-brand-500 outline-none transition"
          />
        </div>
      </div>

      {/* Transcript Dialogue Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No dialogue recorded yet.</p>
            <p className="mt-1">Speak into your mic or type a dialogue below.</p>
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isMe = currentUser && (seg.speakerId === currentUser.id || seg.speakerName === currentUser.fullName);

            return (
              <div key={seg.segmentId || idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className={`font-semibold ${isMe ? 'text-brand-500' : 'text-slate-700 dark:text-slate-300'} flex items-center gap-1`}>
                    <User className="w-3 h-3" />
                    {seg.speakerName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                  isMe
                    ? 'bg-brand-500/10 text-slate-900 dark:text-slate-100 border border-brand-500/20'
                    : 'bg-slate-100 dark:bg-dark-800 text-slate-800 dark:text-slate-200'
                }`}>
                  {seg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Dialogue / Note Input */}
      <form onSubmit={handleSendManual} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input
          type="text"
          placeholder="Type spoken dialogue or note..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-100 dark:bg-dark-800 text-slate-900 dark:text-white rounded-xl text-xs border border-transparent focus:border-brand-500 outline-none transition"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!manualInput.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
};

export default TranscriptPanel;
