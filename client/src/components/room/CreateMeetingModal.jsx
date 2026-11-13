import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Lock, Shield, Copy, Check } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { meetingService } from '../../services/meetingService';

const CreateMeetingModal = ({ isOpen, onClose, onCreated, initialTab = 'instant' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab); // 'instant' | 'schedule'

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Form states
  const [title, setTitle] = useState('');
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [duration, setDuration] = useState('30');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const resetState = () => {
    setTitle('');
    setEnablePassword(false);
    setPassword('');
    setEnableWaitingRoom(false);
    setError('');
    setCreatedMeeting(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleInstantSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const meeting = await meetingService.createInstantMeeting({
        title: title.trim() || 'NEXORA Instant Meeting',
        password: enablePassword ? password.trim() : null,
        settings: {
          waitingRoomEnabled: enableWaitingRoom
        }
      });

      setCreatedMeeting(meeting);
      if (onCreated) onCreated(meeting);
    } catch (err) {
      setError(err.message || 'Failed to create instant meeting.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const meeting = await meetingService.scheduleMeeting({
        title: title.trim() || 'Scheduled Conference',
        scheduledDate,
        scheduledTime,
        duration: parseInt(duration, 10) || 30,
        password: enablePassword ? password.trim() : null,
        settings: {
          waitingRoomEnabled: enableWaitingRoom
        }
      });

      setCreatedMeeting(meeting);
      if (onCreated) onCreated(meeting);
    } catch (err) {
      setError(err.message || 'Failed to schedule meeting.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdMeeting) return;
    const url = `${window.location.origin}/room/${createdMeeting.meetingId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdMeeting ? 'Meeting Created Successfully' : 'Create a Meeting'}
      subtitle={createdMeeting ? 'Share the meeting details with participants' : 'Start right away or schedule for your team'}
    >
      {createdMeeting ? (
        <div className="space-y-4">
          <div className="p-4 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-2xl space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center justify-between">
              <span>{createdMeeting.status === 'scheduled' ? 'Scheduled Meeting' : 'Live Meeting Room'}</span>
              <span className="font-mono text-[11px] bg-brand-200 dark:bg-brand-900/60 px-2 py-0.5 rounded">
                {createdMeeting.meetingId}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {createdMeeting.title}
            </h4>

            {createdMeeting.status === 'scheduled' && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {new Date(createdMeeting.scheduledDate).toLocaleDateString()} at {createdMeeting.scheduledTime} ({createdMeeting.duration} mins)
              </p>
            )}

            {createdMeeting.isPasswordProtected && (
              <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Password protected room</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Shareable Invite Link
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${window.location.origin}/room/${createdMeeting.meetingId}`}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
              />
              <Button variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
                {copiedLink ? <Check className="w-4 h-4 text-emerald-500 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={handleClose}>
              Done
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                handleClose();
                navigate(`/room/${createdMeeting.meetingId}`);
              }}
            >
              <Video className="w-4 h-4 mr-1.5" />
              Enter Room Now
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-850 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('instant')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'instant'
                  ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Instant Meeting
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'schedule'
                  ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Schedule Future
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={activeTab === 'instant' ? handleInstantSubmit : handleScheduleSubmit} className="space-y-4">
            <Input
              label="Meeting Topic / Title"
              placeholder={activeTab === 'instant' ? 'e.g. Ad-hoc Team Sync' : 'e.g. Q4 Sprint Planning'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              icon={Video}
            />

            {activeTab === 'schedule' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                    icon={Calendar}
                  />
                  <Input
                    label="Time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required
                    icon={Clock}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                  </select>
                </div>
              </>
            )}

            {/* Security Options */}
            <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Security & Room Settings
              </span>

              {/* Waiting Room Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-brand-500" />
                    <span>Enable Waiting Room</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Host must approve guests before they enter
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableWaitingRoom}
                  onChange={(e) => setEnableWaitingRoom(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500"
                />
              </div>

              {/* Password Protection Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Require Meeting Password</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Attendees must enter a password to join
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500"
                  />
                </div>

                {enablePassword && (
                  <Input
                    placeholder="Set meeting password..."
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={enablePassword}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isLoading}>
                {activeTab === 'instant' ? (
                  <>
                    <Video className="w-4 h-4 mr-1.5" />
                    Start Instant Meeting
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-1.5" />
                    Schedule Conference
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
};

export default CreateMeetingModal;
