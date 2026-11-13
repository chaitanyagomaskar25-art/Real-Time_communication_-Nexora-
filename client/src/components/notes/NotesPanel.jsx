import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Download,
  Share2,
  X,
  User,
  CheckCircle2,
  Copy,
  Printer
} from 'lucide-react';
import Badge from '../common/Badge';
import { meetingService } from '../../services/meetingService';

const NotesPanel = ({ isOpen, onClose, roomId, socket, currentUser }) => {
  const [content, setContent] = useState('');
  const [lastEditedBy, setLastEditedBy] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Load initial notes from server
  useEffect(() => {
    if (!isOpen || !roomId) return;

    let isMounted = true;
    const fetchNotes = async () => {
      try {
        const res = await meetingService.getMeetingNotes(roomId);
        const data = res?.data || res || {};
        if (isMounted && data.content !== undefined) {
          setContent(data.content);
          setLastEditedBy(data.lastEditedBy);
          if (data.updatedAt) setLastSavedAt(new Date(data.updatedAt));
        }
      } catch {
        // Safe ignore
      }
    };

    fetchNotes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId]);

  // Listen to remote real-time updates via Socket.IO
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleNotesUpdated = (data) => {
      if (data.meetingId === roomId) {
        setContent(data.content || '');
        setLastEditedBy(data.lastEditedBy || 'Participant');
        setLastSavedAt(new Date(data.timestamp || Date.now()));
      }
    };

    socket.on('notes-updated', handleNotesUpdated);
    return () => {
      socket.off('notes-updated', handleNotesUpdated);
    };
  }, [socket, roomId]);

  // Auto-save debounced to backend
  const persistNotes = useCallback(async (text) => {
    setIsSaving(true);
    try {
      await meetingService.saveMeetingNotes(roomId, text);
      setLastSavedAt(new Date());
    } catch {
      // Safe ignore
    } finally {
      setIsSaving(false);
    }
  }, [roomId]);

  // Handle local user typing
  const handleContentChange = (e) => {
    const text = e.target.value;
    setContent(text);
    isTypingRef.current = true;

    const myName = currentUser?.fullName || currentUser?.name || 'You';
    setLastEditedBy(myName);

    // Emit live changes to peer sockets
    if (socket) {
      socket.emit('notes-update', { roomId, content: text });
    }

    // Debounced persist to database
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistNotes(text);
      isTypingRef.current = false;
    }, 1200);
  };

  // Export as Plain Text (.txt)
  const handleExportText = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as Markdown (.md)
  const handleExportMarkdown = () => {
    const header = `# NEXORA Meeting Notes\n**Room ID:** ${roomId}\n**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
    const blob = new Blob([header + content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${roomId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print / Save to PDF via browser print
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Meeting Notes - ${roomId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { font-size: 24px; margin-bottom: 8px; color: #0f172a; }
            .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 15px; }
          </style>
        </head>
        <body>
          <h1>NEXORA Collaborative Meeting Notes</h1>
          <div class="meta">
            Meeting Room: <strong>${roomId}</strong> | Exported: ${new Date().toLocaleString()}
          </div>
          <pre>${content || 'No notes taken during this session.'}</pre>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (!isOpen) return null;

  return (
    <aside className="fixed top-0 right-0 bottom-0 z-40 w-80 sm:w-96 bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 animate-slide-left">
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Meeting Notes</span>
              <Badge variant="primary" size="sm">
                Shared
              </Badge>
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              {isSaving ? (
                <span className="text-amber-500 font-semibold animate-pulse">Saving...</span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Saved
                </span>
              ) : (
                <span>Auto-saves live</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Toolbar */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportText}
            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Download Plain Text (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportMarkdown}
            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Download Markdown (.md)"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePrintPDF}
            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Export / Print PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Copy all notes"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <span className="text-[10px] text-slate-400">
          {wordCount} words · {charCount} chars
        </span>
      </div>

      {/* Notes Textarea Editor */}
      <div className="flex-1 p-4 flex flex-col">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start typing shared meeting notes, action items, or key takeaways... Everyone in this meeting can view and edit live in real-time."
          className="w-full flex-1 p-3 text-xs leading-relaxed rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
        />
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-dark-900 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1 truncate mr-2">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">
            Last edit: <strong>{lastEditedBy || 'None'}</strong>
          </span>
        </div>

        <button
          onClick={() => persistNotes(content)}
          disabled={isSaving}
          className="text-brand-600 dark:text-brand-400 hover:underline font-semibold shrink-0"
        >
          Save Now
        </button>
      </div>
    </aside>
  );
};

export default NotesPanel;
