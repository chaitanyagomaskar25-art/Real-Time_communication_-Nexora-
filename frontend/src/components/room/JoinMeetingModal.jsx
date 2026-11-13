import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { meetingService } from '../../services/meetingService';

const JoinMeetingModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [meetingInput, setMeetingInput] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const extractMeetingId = (input) => {
    const trimmed = input.trim();
    if (trimmed.includes('/room/')) {
      return trimmed.split('/room/')[1].split('?')[0].split('#')[0];
    }
    return trimmed;
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanId = extractMeetingId(meetingInput);
    if (!cleanId) {
      setError('Please enter a meeting code or invitation link');
      return;
    }

    setIsLoading(true);
    try {
      const validation = await meetingService.validateMeetingAccess(cleanId, password);

      if (validation.requiresPassword && !needsPassword) {
        setNeedsPassword(true);
        setIsLoading(false);
        return;
      }

      // Validated successfully
      onClose();
      navigate(`/room/${cleanId}`, { state: { password: password.trim() } });
    } catch (err) {
      setError(err.message || 'Unable to join meeting. Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setMeetingInput('');
    setPassword('');
    setNeedsPassword(false);
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join a Meeting"
      subtitle="Enter the code or invite link to join the conference"
    >
      <form onSubmit={handleJoin} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Meeting Code or Link"
          placeholder="e.g. 5947-36ee-9367 or link"
          value={meetingInput}
          onChange={(e) => {
            setMeetingInput(e.target.value);
            setNeedsPassword(false);
            setError('');
          }}
          required
          icon={PhoneCall}
        />

        {needsPassword && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Password Protected Meeting</span>
            </div>
            <Input
              type="password"
              placeholder="Enter meeting password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            <ArrowRight className="w-4 h-4 mr-1.5" />
            Join Meeting
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default JoinMeetingModal;
