import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, Link2, Mail, Send, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import { meetingService } from '../../services/meetingService';

const RoomInfoModal = ({ isOpen, onClose, roomId, roomTitle }) => {
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  if (!isOpen) return null;

  const joinUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSending(true);
    setInviteSuccess('');
    setInviteError('');

    try {
      await meetingService.inviteToMeeting(roomId, { email: inviteEmail.trim() });
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err) {
      setInviteError(err?.response?.data?.message || err.message || 'Failed to send invitation.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Meeting Details & Invite</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Meeting Title
            </label>
            <div className="text-sm font-medium text-slate-200 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              {roomTitle || 'NEXORA Conference'}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Room Code
            </label>
            <div className="text-sm font-mono text-brand-300 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              {roomId}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Invite Link
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={joinUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
              />
              <Button
                variant={copied ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          {/* In-Meeting Direct Email Invite */}
          <div className="pt-2 border-t border-slate-800/60">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              <span>Invite Attendee by Email</span>
            </label>
            <form onSubmit={handleSendInvite} className="flex items-center gap-2">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSending}
                disabled={!inviteEmail.trim()}
                className="shrink-0"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Invite
              </Button>
            </form>
            {inviteSuccess && (
              <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{inviteSuccess}</span>
              </p>
            )}
            {inviteError && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{inviteError}</span>
              </p>
            )}
          </div>

          <div className="p-3 bg-brand-950/40 border border-brand-800/30 rounded-xl text-xs text-brand-300 flex items-start gap-2">
            <Link2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>People who have this link or room code will be able to join your video conference.</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoomInfoModal;
