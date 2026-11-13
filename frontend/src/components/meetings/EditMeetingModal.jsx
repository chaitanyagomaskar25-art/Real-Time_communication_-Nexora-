import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Globe,
  Mail,
  Lock,
  Shield,
  Repeat,
  X,
  AlertCircle,
  Trash2
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

const EditMeetingModal = ({ isOpen, onClose, meeting, onUpdated, onCancelled }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [timezone, setTimezone] = useState('UTC');

  const [inviteeInput, setInviteeInput] = useState('');
  const [invitees, setInvitees] = useState([]);

  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title || '');
      setDescription(meeting.description || '');

      let dateVal = '';
      if (meeting.scheduledDate) {
        dateVal = new Date(meeting.scheduledDate).toISOString().split('T')[0];
      } else if (meeting.startTime) {
        dateVal = new Date(meeting.startTime).toISOString().split('T')[0];
      }
      setScheduledDate(dateVal || new Date().toISOString().split('T')[0]);

      setScheduledTime(meeting.scheduledTime || '10:00');
      setDuration(String(meeting.duration || 30));
      setTimezone(meeting.timezone || 'UTC');

      const existingEmails = (meeting.invitees || []).map((i) => (typeof i === 'string' ? i : i.email));
      setInvitees(existingEmails);

      setRecurrenceType(meeting.recurrence?.type || 'none');
      if (meeting.recurrence?.endDate) {
        setRecurrenceEndDate(new Date(meeting.recurrence.endDate).toISOString().split('T')[0]);
      } else {
        setRecurrenceEndDate('');
      }

      setEnablePassword(Boolean(meeting.isPasswordProtected));
      setPassword('');
      setEnableWaitingRoom(Boolean(meeting.settings?.waitingRoomEnabled));
      setError('');
    }
  }, [meeting]);

  const handleAddInvitee = (e) => {
    if (e) e.preventDefault();
    const email = inviteeInput.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (invitees.includes(email)) {
      setError('This email is already in the invite list.');
      return;
    }

    setInvitees((prev) => [...prev, email]);
    setInviteeInput('');
    setError('');
  };

  const handleRemoveInvitee = (email) => {
    setInvitees((prev) => prev.filter((e) => e !== email));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!meeting?.meetingId) return;

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
          waitingRoomEnabled: enableWaitingRoom
        }
      };

      const updated = await meetingService.updateScheduledMeeting(meeting.meetingId, payload);
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update meeting.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!meeting?.meetingId) return;
    const confirm = window.confirm(`Are you sure you want to cancel "${meeting.title}"? Attendees will be notified and reminders cancelled.`);
    if (!confirm) return;

    setIsCancelling(true);
    setError('');

    try {
      await meetingService.cancelMeeting(meeting.meetingId);
      if (onCancelled) onCancelled(meeting.meetingId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to cancel meeting.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isOpen || !meeting) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Scheduled Meeting"
      subtitle={`Update details for ${meeting.meetingId}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Meeting Topic *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
          />
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
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Invitees */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-brand-500" />
            <span>Invitees</span>
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="attendee@company.com"
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
                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Repeat className="w-3.5 h-3.5 text-brand-500" />
            <span>Recurrence</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value)}
              className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Repeats Daily</option>
              <option value="weekly">Repeats Weekly</option>
              <option value="monthly">Repeats Monthly</option>
            </select>
            {recurrenceType !== 'none' && (
              <input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        {/* Security & Access */}
        <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-700 dark:text-slate-300">Password Protection</span>
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
              placeholder="Leave blank to keep existing password, or enter new"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-700 dark:text-slate-300">Enable Waiting Room</span>
            </div>
            <input
              type="checkbox"
              checked={enableWaitingRoom}
              onChange={(e) => setEnableWaitingRoom(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4"
            />
          </div>
        </div>

        {/* Footer with Save and Cancel Meeting options */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            onClick={handleCancelMeeting}
            isLoading={isCancelling}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Cancel Meeting
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditMeetingModal;

