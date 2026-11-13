import React, { useState } from 'react';
import { Calendar, Clock, Video, Copy, Check } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';

const ScheduleMeetingModal = ({ isOpen, onClose, onSchedule }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [duration, setDuration] = useState('30');
  const [isCopied, setIsCopied] = useState(false);
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  const handleGenerate = (e) => {
    e.preventDefault();
    const cleanId = Math.random().toString(36).substring(2, 6) + '-' +
                    Math.random().toString(36).substring(2, 6) + '-' +
                    Math.random().toString(36).substring(2, 6);
    
    const newMeeting = {
      id: 'sched_' + Date.now(),
      roomId: cleanId,
      title: title.trim() || 'Scheduled Conference',
      date,
      time,
      duration: `${duration} mins`,
      participantsCount: 1,
      isScheduled: true
    };

    setGeneratedRoomId(cleanId);
    setIsScheduled(true);
    if (onSchedule) {
      onSchedule(newMeeting);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${generatedRoomId}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setIsScheduled(false);
    setTitle('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={isScheduled ? 'Meeting Scheduled Successfully' : 'Schedule a Meeting'}
      subtitle={isScheduled ? 'Share the meeting link with attendees' : 'Set up a future meeting room and calendar invite'}
    >
      {isScheduled ? (
        <div className="space-y-4">
          <div className="p-4 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-xl space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {date} at {time} ({duration} mins)
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {title || 'Scheduled Conference'}
            </div>
            <div className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              Code: {generatedRoomId}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {isCopied ? 'Link Copied!' : 'Copy Invitation Link'}
            </Button>
            <Button
              variant="primary"
              onClick={handleResetAndClose}
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-4">
          <Input
            label="Meeting Topic"
            placeholder="e.g. Weekly Engineering Sync"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            icon={Video}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              icon={Calendar}
            />
            <Input
              label="Start Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              icon={Clock}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Duration
            </label>
            <div className="relative">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ScheduleMeetingModal;
