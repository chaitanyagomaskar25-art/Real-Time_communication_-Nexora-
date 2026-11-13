import React, { useState, useEffect, useMemo } from 'react';
import {
  Film,
  Play,
  Download,
  Trash2,
  Shield,
  Search,
  Clock,
  HardDrive,
  Calendar,
  X,
  Users,
  Lock,
  Globe,
  AlertCircle
} from 'lucide-react';
import { recordingService } from '../services/recordingService';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs === 0) return `${remMins}m ${secs}s`;
  return `${hrs}h ${remMins}m ${secs}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const Recordings = () => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  // Player state
  const [activePlayerRecording, setActivePlayerRecording] = useState(null);
  const [videoError, setVideoError] = useState(false);

  // Delete state
  const [deletingRecording, setDeletingRecording] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions state
  const [permissionsRecording, setPermissionsRecording] = useState(null);
  const [permIsPublic, setPermIsPublic] = useState(false);
  const [permAllowedRole, setPermAllowedRole] = useState('participant');
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  const [unplayableIds, setUnplayableIds] = useState(new Set());

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await recordingService.getRecordings();
      // Ensure we only keep workable recordings with non-zero size/duration
      const validOnly = (data || []).filter(
        (r) => r.recordingId && r.status !== 'failed' && (r.fileSize > 0 || r.duration > 0)
      );
      setRecordings(validOnly);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const filteredRecordings = useMemo(() => {
    return recordings
      .filter((r) => !unplayableIds.has(r.recordingId))
      .filter((r) => {
        // Exclude zero-byte or pending recordings
        if (r.fileSize === 0 && r.status === 'recording') return false;
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
          r.meetingTitle?.toLowerCase().includes(q) ||
          r.meetingId?.toLowerCase().includes(q) ||
          r.hostName?.toLowerCase().includes(q)
        );
      });
  }, [recordings, searchQuery, unplayableIds]);

  const handlePlayRecording = (rec) => {
    setVideoError(false);
    setActivePlayerRecording(rec);
  };

  const handleRemoveFromList = async (rec) => {
    const isHost = Boolean(
      rec.isHost || (user && rec.host && rec.host.toString() === (user.id || user._id)?.toString())
    );

    if (isHost) {
      setDeletingRecording(rec);
      return;
    }

    // For participants, remove recording from their library view immediately
    setUnplayableIds((prev) => new Set([...prev, rec.recordingId]));
    setRecordings((prev) => prev.filter((r) => r.recordingId !== rec.recordingId));
    setActionMessage({ type: 'success', text: 'Recording removed from your library list.' });
    setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
  };

  const handleRemoveBrokenRecording = async (recId) => {
    setUnplayableIds((prev) => new Set([...prev, recId]));
    setRecordings((prev) => prev.filter((r) => r.recordingId !== recId));
    setActivePlayerRecording(null);
    setVideoError(false);
    try {
      await recordingService.deleteRecording(recId);
    } catch {}
    setActionMessage({ type: 'success', text: 'Unplayable video removed from your list.' });
    setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
  };

  const handleDelete = async () => {
    if (!deletingRecording) return;
    try {
      setIsDeleting(true);
      await recordingService.deleteRecording(deletingRecording.recordingId);
      setRecordings((prev) => prev.filter((r) => r.recordingId !== deletingRecording.recordingId));
      setDeletingRecording(null);
      setActionMessage({ type: 'success', text: 'Recording permanently deleted.' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Could not delete recording' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenPermissions = (rec) => {
    setPermissionsRecording(rec);
    setPermIsPublic(Boolean(rec.accessSettings?.isPublic));
    setPermAllowedRole(rec.accessSettings?.allowedRoles?.includes('participant') ? 'participant' : 'host');
  };

  const handleSavePermissions = async () => {
    if (!permissionsRecording) return;
    try {
      setIsSavingPerms(true);
      const updated = await recordingService.updatePermissions(permissionsRecording.recordingId, {
        isPublic: permIsPublic,
        allowedRoles: permAllowedRole === 'participant' ? ['host', 'participant'] : ['host']
      });
      setRecordings((prev) =>
        prev.map((r) => (r.recordingId === permissionsRecording.recordingId ? { ...r, accessSettings: updated.accessSettings } : r))
      );
      setPermissionsRecording(null);
      setActionMessage({ type: 'success', text: 'Recording permissions updated successfully.' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to update permissions' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
    } finally {
      setIsSavingPerms(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Film className="w-6 h-6" />
            </div>
            Meeting Recordings Library
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Replay and download meeting recordings where you participated as host or attendee.
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <Input
            icon={Search}
            placeholder="Search by meeting title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionMessage.text && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-fade-in ${
            actionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage({ type: '', text: '' })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={fetchRecordings} className="ml-auto underline font-medium">Retry</button>
        </div>
      )}

      {/* Recordings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No recordings found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery ? 'No recordings match your search query.' : 'Recordings will appear here after a meeting host records a session.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecordings.map((rec) => {
            const isHost = Boolean(
              rec.isHost || (user && rec.host && rec.host.toString() === (user.id || user._id)?.toString())
            );

            return (
              <div
                key={rec.recordingId}
                className="group relative bg-white dark:bg-dark-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-card hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-elevated transition-all duration-200 flex flex-col"
              >
                {/* Video Preview Card Thumbnail */}
                <div
                  className="relative aspect-video bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden group-hover:brightness-95 transition-all"
                  onClick={() => handlePlayRecording(rec)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                  {/* Play Button Overlay */}
                  <div className="w-12 h-12 rounded-full bg-white/95 text-brand-600 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform z-20">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      REC
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-black/60 backdrop-blur-sm text-white">
                      {rec.mimeType?.includes('webm') ? 'WebM' : 'MP4'}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 z-20">
                    {rec.accessSettings?.isPublic ? (
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Restricted
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-3 right-3 z-20 px-2 py-1 rounded-md text-xs font-medium bg-black/70 text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-400" />
                    {formatDuration(rec.duration)}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {rec.meetingTitle || `Meeting ${rec.meetingId}`}
                    </h3>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(rec.startedAt || rec.createdAt).toLocaleDateString()} at {new Date(rec.startedAt || rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatFileSize(rec.fileSize)}</span>
                        <span>•</span>
                        <span>Host: {rec.hostName || 'Host'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handlePlayRecording(rec)}
                        className="flex items-center gap-1.5 py-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Play
                      </Button>

                      <a
                        href={recordingService.getDownloadUrl(rec.recordingId)}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleOpenPermissions(rec)}
                          title="Manage Access Permissions"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors cursor-pointer"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromList(rec)}
                        title={isHost ? "Delete Recording" : "Remove from my list"}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {activePlayerRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Player Header */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">
                  {activePlayerRecording.meetingTitle || `Meeting ${activePlayerRecording.meetingId}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recorded on {new Date(activePlayerRecording.startedAt || activePlayerRecording.createdAt).toLocaleString()} • Duration: {formatDuration(activePlayerRecording.duration)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePlayerRecording(null);
                  setVideoError(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Element */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {videoError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <AlertCircle className="w-12 h-12 text-amber-400" />
                  <p className="text-white font-semibold text-sm">Streaming preview could not be rendered directly in browser</p>
                  <p className="text-slate-400 text-xs max-w-md">
                    This media format may require system codecs. You can download the video directly to play it in any local player (VLC, QuickTime, Windows Media Player).
                  </p>
                  <div className="flex items-center gap-2.5 pt-1">
                    <a
                      href={recordingService.getDownloadUrl(activePlayerRecording.recordingId)}
                      download
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Video File
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveBrokenRecording(activePlayerRecording.recordingId)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 text-xs font-semibold flex items-center gap-2 transition cursor-pointer border border-slate-700 hover:border-rose-800"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove from List
                    </button>
                  </div>
                </div>
              ) : (
                <video
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  className="w-full h-full object-contain"
                  src={recordingService.getStreamUrl(activePlayerRecording.recordingId)}
                >
                  <source
                    src={recordingService.getStreamUrl(activePlayerRecording.recordingId)}
                    type={activePlayerRecording.mimeType || 'video/webm'}
                  />
                  Your browser does not support HTML5 video playback.
                </video>
              )}
            </div>

            {/* Player Footer */}
            <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Format: {activePlayerRecording.mimeType || 'video/webm'} • Size: {formatFileSize(activePlayerRecording.fileSize)}</span>
              <a
                href={recordingService.getDownloadUrl(activePlayerRecording.recordingId)}
                download
                className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-medium cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Video
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingRecording)}
        onClose={() => setDeletingRecording(null)}
        title="Delete Meeting Recording"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to permanently delete the recording for{' '}
            <strong className="text-slate-900 dark:text-white">
              {deletingRecording?.meetingTitle || deletingRecording?.meetingId}
            </strong>
            ? This action cannot be undone and will delete the physical video from storage.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingRecording(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Recording
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={Boolean(permissionsRecording)}
        onClose={() => setPermissionsRecording(null)}
        title="Recording Access Permissions"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configure who can view, stream, and download this recording:
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-dark-800/50 cursor-pointer">
              <input
                type="radio"
                name="recordingAccess"
                checked={!permIsPublic && permAllowedRole === 'participant'}
                onChange={() => {
                  setPermIsPublic(false);
                  setPermAllowedRole('participant');
                }}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-500" />
                  Meeting Participants Only
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Only users who attended this meeting can view and download.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-dark-800/50 cursor-pointer">
              <input
                type="radio"
                name="recordingAccess"
                checked={!permIsPublic && permAllowedRole === 'host'}
                onChange={() => {
                  setPermIsPublic(false);
                  setPermAllowedRole('host');
                }}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Host Only (Private)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Only you (the meeting host) can access this recording.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-dark-800/50 cursor-pointer">
              <input
                type="radio"
                name="recordingAccess"
                checked={permIsPublic}
                onChange={() => {
                  setPermIsPublic(true);
                }}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  Public (Anyone with link)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Accessible to anyone with the recording stream or download link.
                </div>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPermissionsRecording(null)}
              disabled={isSavingPerms}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSavePermissions}
              isLoading={isSavingPerms}
            >
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Recordings;
