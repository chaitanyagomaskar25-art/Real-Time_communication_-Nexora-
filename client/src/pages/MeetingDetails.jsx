import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Video,
  Shield,
  Lock,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Sparkles,
  Flag
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useAuth } from '../hooks/useAuth';
import { meetingService } from '../services/meetingService';
import { adminService } from '../services/adminService';
import AIInsightsModal from '../components/ai/AIInsightsModal';

const MeetingDetails = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDesc, setReportDesc] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchMeeting = async () => {
      try {
        const data = await meetingService.getMeetingDetails(meetingId);
        if (isMounted) setMeeting(data);
      } catch (err) {
        if (isMounted) setError(err.message || 'Meeting not found');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMeeting();
    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${meetingId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCancelMeeting = async () => {
    if (!window.confirm('Are you sure you want to cancel this scheduled meeting?')) return;
    setIsCancelling(true);
    try {
      await meetingService.cancelMeeting(meetingId);
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Failed to cancel meeting.');
      setIsCancelling(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingReport(true);
      await adminService.reportMeeting(meetingId, {
        reason: reportReason,
        description: reportDesc
      });
      setReportSuccessMsg('Report submitted successfully to administrators for investigation.');
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccessMsg('');
        setReportDesc('');
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading meeting details...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meeting Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The requested meeting code ({meetingId}) could not be retrieved.
        </p>
        <Link to="/dashboard">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const isHost = meeting.isHost || (user && meeting.host && meeting.host.toString() === (user.id || user._id)?.toString());
  const inviteUrl = `${window.location.origin}/room/${meeting.meetingId}`;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300 font-semibold">{meeting.meetingId}</span>
      </div>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={meeting.status === 'active' ? 'success' : meeting.status === 'scheduled' ? 'primary' : 'default'} size="sm" dot>
              {meeting.status.toUpperCase()}
            </Badge>
            {isHost && <Badge variant="primary" size="sm">You are Host</Badge>}
            {meeting.isPasswordProtected && (
              <Badge variant="warning" size="sm">
                <Lock className="w-3 h-3 mr-1" />
                Password Protected
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {meeting.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organized by <span className="font-semibold text-slate-700 dark:text-slate-300">{meeting.hostName || 'Host'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsInsightsOpen(true)}
            className="border-brand-500/30 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-brand-600 dark:text-brand-400" />
            AI Insights & Summary
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copiedLink ? 'Copied' : 'Copy Invite Link'}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsReportModalOpen(true)}
            className="text-slate-500 hover:text-rose-500"
            title="Report inappropriate or abusive meeting"
          >
            <Flag className="w-4 h-4 mr-1.5 text-rose-500" />
            Report
          </Button>

          {meeting.status !== 'ended' && meeting.status !== 'cancelled' && (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/room/${meeting.meetingId}`)}
            >
              <Video className="w-4 h-4 mr-1.5" />
              Join Call
            </Button>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Meeting Specifications
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1">
                <span className="text-slate-400">Meeting ID</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{meeting.meetingId}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1">
                <span className="text-slate-400">Estimated Duration</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{meeting.duration || 30} minutes</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1">
                <span className="text-slate-400">Scheduled Date</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {meeting.scheduledDate ? new Date(meeting.scheduledDate).toLocaleDateString() : 'Instant Meeting'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1">
                <span className="text-slate-400">Scheduled Time</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{meeting.scheduledTime || 'N/A'}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Direct Link
              </label>
              <input
                readOnly
                value={inviteUrl}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Participants History */}
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500" />
                Participant Roster ({meeting.participants?.length || 0})
              </h3>
            </div>

            {meeting.participants?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No participants have logged into this room yet.</p>
            ) : (
              <div className="space-y-2">
                {meeting.participants.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2 font-mono">({p.role})</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Joined at {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Settings & Host Controls */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-500" />
              Room Settings
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                <span>Waiting Room</span>
                <span className={`font-semibold ${meeting.settings?.waitingRoomEnabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {meeting.settings?.waitingRoomEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                <span>Meeting Locked</span>
                <span className={`font-semibold ${meeting.settings?.isLocked ? 'text-amber-500' : 'text-slate-400'}`}>
                  {meeting.settings?.isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                <span>Screen Sharing</span>
                <span className="font-semibold text-emerald-500">Allowed</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                <span>In-Call Chat</span>
                <span className="font-semibold text-emerald-500">Allowed</span>
              </div>
            </div>

            {/* Host Cancellation Control */}
            {isHost && meeting.status !== 'ended' && meeting.status !== 'cancelled' && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={handleCancelMeeting}
                  isLoading={isCancelling}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Cancel Scheduled Meeting
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Abuse Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleSubmitReport}
            className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Report Meeting</h3>
                <p className="text-xs text-slate-400">Meeting: {meeting.title} ({meeting.meetingId})</p>
              </div>
            </div>

            {reportSuccessMsg ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 rounded-xl">
                {reportSuccessMsg}
              </div>
            ) : (
              <>
                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Reason for Report
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="harassment">Harassment or Bullying</option>
                    <option value="inappropriate_content">Inappropriate / Explicit Content</option>
                    <option value="spam">Spam or Unsolicited Promotion</option>
                    <option value="security_violation">Security or Privacy Violation</option>
                    <option value="other">Other Abusive Behavior</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Additional Details
                  </label>
                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Provide details about the incident for the admin team..."
                    rows={3}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    type="submit"
                    isLoading={isSubmittingReport}
                  >
                    Submit Report
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* AI Insights, Summary & Action Items Modal */}
      <AIInsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        meetingId={meeting.meetingId}
        isHost={isHost}
      />
    </div>
  );
};

export default MeetingDetails;
