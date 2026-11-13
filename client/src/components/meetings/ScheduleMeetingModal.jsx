import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Globe,
  Mail,
  Lock,
  Shield,
  Repeat,
  Copy,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { meetingService } from '../../services/meetingService';

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'New York (Eastern Time - US/Canada)' },
  { value: 'America/Chicago', label: 'Chicago (Central Time - US/Canada)' },
  { value: 'America/Denver', label: 'Denver (Mountain Time - US/Canada)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific Time - US/Canada)' },
  { value: 'Europe/London', label: 'London (GMT / BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST - New Delhi, Mumbai)' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
];

const ScheduleMeetingModal = ({ isOpen, onClose, onScheduled, initialDate = null }) => {
  // Detected user local timezone
  const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => initialDate || new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [timezone, setTimezone] = useState(defaultTz);

  // Invitees tag list
  const [inviteeInput, setInviteeInput] = useState('');
  const [invitees, setInvitees] = useState([]);

  // Recurrence
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Security
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(false);
  const [muteOnEntry, setMuteOnEntry] = useState(false);

  // State flags
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (initialDate) {
      setScheduledDate(initialDate);
    }
  }, [initialDate]);

  // Reset form
  const handleReset = () => {
    setTitle('');
    setDescription('');
    setScheduledDate(initialDate || new Date().toISOString().split('T')[0]);
    setScheduledTime('10:00');
    setDuration('30');
    setTimezone(defaultTz);
    setInvitees([]);
    setInviteeInput('');
    setRecurrenceType('none');
    setRecurrenceEndDate('');
    setEnablePassword(false);
    setPassword('');
    setEnableWaitingRoom(false);
    setMuteOnEntry(false);
    setError('');
    setCreatedMeeting(null);
    setIsCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Add Invitee Email chip
  const handleAddInvitee = (e) => {
    if (e) e.preventDefault();
    const email = inviteeInput.trim().toLowerCase();
    if (!email) return;

    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (invitees.includes(email)) {
      setError('This email is already on the invite list.');
      return;
    }

    setInvitees((prev) => [...prev, email]);
    setInviteeInput('');
    setError('');
  };

  const handleRemoveInvitee = (emailToRemove) => {
    setInvitees((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // Submit schedule form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        scheduledDate,
        scheduledTime,
        duration: parseInt(duration, 10) || 30,
        timezone,
        invitees,
        recurrence: {
          type: recurrenceType,
          interval: 1,
          endDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null
        },
        password: enablePassword ? password.trim() : null,
        settings: {
          waitingRoomEnabled: enableWaitingRoom,
          muteOnEntry
        }
      };

      const result = await meetingService.scheduleMeeting(payload);
      setCreatedMeeting(result);
      if (onScheduled) onScheduled(result);
    } catch (err) {
      setError(err.message || 'Failed to schedule meeting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate full formatted invitation text for copying
  const generateInvitationText = () => {
    if (!createdMeeting) return '';
    const joinUrl = createdMeeting.inviteLink || `${window.location.origin}/room/${createdMeeting.meetingId}`;
    return `You're invited to a NEXORA video meeting:

Topic: ${createdMeeting.title}
${createdMeeting.description ? `Description: ${createdMeeting.description}\n` : ''}Date: ${scheduledDate}
Time: ${scheduledTime} (${timezone})
Duration: ${duration} minutes

Join Meeting:
${joinUrl}

Meeting ID: ${createdMeeting.meetingId}
${createdMeeting.isPasswordProtected ? `Passcode: ${password || '[Required]'}` : 'Passcode: None'}
`;
  };

  const handleCopyInvitation = () => {
    const text = generateInvitationText();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdMeeting ? 'Meeting Scheduled Successfully' : 'Schedule a Meeting'}
      subtitle={
        createdMeeting
          ? 'Share the invitation link with your attendees'
          : 'Plan future conferences with automatic timezone conversion and calendar invites'
      }
    >
      {createdMeeting ? (
        <div className="space-y-4 animate-fade-in text-xs">
          {/* Meeting Card Preview */}
          <div className="p-4 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-900/50 px-2.5 py-1 rounded-full">
                Scheduled Meeting
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {duration} mins
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{createdMeeting.title}</h4>
              {createdMeeting.description && (
                <p className="text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                  {createdMeeting.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-brand-500" />
                <span>{scheduledDate}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                <span>{scheduledTime}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 col-span-2">
                <Globe className="w-3.5 h-3.5 text-brand-500" />
                <span className="truncate">{timezone}</span>
              </div>
            </div>

            {invitees.length > 0 && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <strong>{invitees.length}</strong> attendee{invitees.length > 1 ? 's' : ''} invited
              </div>
            )}

            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-mono text-slate-800 dark:text-slate-200 text-xs truncate mr-2">
                {createdMeeting.inviteLink || `${window.location.origin}/room/${createdMeeting.meetingId}`}
              </span>
              <button
                onClick={handleCopyInvitation}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold shrink-0 cursor-pointer text-xs flex items-center gap-1"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={handleCopyInvitation}>
              {isCopied ? <Check className="w-4 h-4 text-emerald-500 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {isCopied ? 'Full Invitation Copied' : 'Copy Full Invitation Text'}
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-3">
            <Input
              label="Meeting Topic *"
              placeholder="e.g. Q4 Strategy & Roadmap Alignment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description & Agenda (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add meeting agenda, discussion topics, or preparation notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>
          </div>

          {/* Date, Time, Duration & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand-500" />
                <span>Date *</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                <span>Start Time *</span>
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-brand-500" />
                <span>Timezone *</span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              >
                {!COMMON_TIMEZONES.some((t) => t.value === defaultTz) && (
                  <option value={defaultTz}>Local ({defaultTz})</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Invitees by Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-brand-500" />
              <span>Add Invitees by Email</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteeInput}
                onChange={(e) => setInviteeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInvitee();
                  }
                }}
                className="flex-1 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddInvitee}>
                Add
              </Button>
            </div>

            {/* Invitee Chips */}
            {invitees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {invitees.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-full text-[11px]"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInvitee(email)}
                      className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recurrence Options */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Repeat className="w-3.5 h-3.5 text-brand-500" />
              <span>Recurring Meeting</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value)}
                className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Repeats Daily</option>
                <option value="weekly">Repeats Weekly</option>
                <option value="monthly">Repeats Monthly</option>
              </select>

              {recurrenceType !== 'none' && (
                <input
                  type="date"
                  placeholder="End Date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  title="Recurrence End Date"
                />
              )}
            </div>
          </div>

          {/* Security & Access Controls */}
          <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300">Meeting Password Protection</span>
              </div>
              <input
                type="checkbox"
                checked={enablePassword}
                onChange={(e) => setEnablePassword(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
              />
            </div>

            {enablePassword && (
              <input
                type="password"
                placeholder="Enter secure meeting password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={enablePassword}
                className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300">Enable Waiting Room (Host admits attendees)</span>
              </div>
              <input
                type="checkbox"
                checked={enableWaitingRoom}
                onChange={(e) => setEnableWaitingRoom(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              <Calendar className="w-4 h-4 mr-1.5" />
              Schedule Conference
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ScheduleMeetingModal;
