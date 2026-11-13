import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Vote,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { meetingService } from '../../services/meetingService';

const PollsPanel = ({
  isOpen,
  onClose,
  roomId,
  socket,
  currentUser,
  isHost = false,
  isCoHost = false
}) => {
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // New poll form
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = isHost || isCoHost;
  const voterId = currentUser?.id || currentUser?._id;

  // Fetch polls
  const fetchPolls = useCallback(async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const res = await meetingService.getMeetingPolls(roomId);
      const list = res?.data || res || [];
      setPolls(Array.isArray(list) ? list : []);
    } catch {
      // Safe ignore
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (isOpen) {
      fetchPolls();
    }
  }, [isOpen, fetchPolls]);

  // Socket.IO real-time poll events
  useEffect(() => {
    if (!socket || !roomId) return;

    const handlePollCreated = (poll) => {
      if (poll.meetingId === roomId) {
        setPolls((prev) => [poll, ...prev.filter((p) => p.pollId !== poll.pollId)]);
      }
    };

    const handlePollUpdated = (poll) => {
      if (poll.meetingId === roomId) {
        setPolls((prev) =>
          prev.map((p) => (p.pollId === poll.pollId ? { ...p, ...poll } : p))
        );
      }
    };

    const handlePollEnded = (poll) => {
      if (poll.meetingId === roomId) {
        setPolls((prev) =>
          prev.map((p) => (p.pollId === poll.pollId ? { ...p, isActive: false, endedAt: poll.endedAt } : p))
        );
      }
    };

    socket.on('poll-created', handlePollCreated);
    socket.on('poll-updated', handlePollUpdated);
    socket.on('poll-ended', handlePollEnded);

    return () => {
      socket.off('poll-created', handlePollCreated);
      socket.off('poll-updated', handlePollUpdated);
      socket.off('poll-ended', handlePollEnded);
    };
  }, [socket, roomId]);

  // Option handlers
  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions((prev) => [...prev, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Submit new poll
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!question.trim()) {
      setFormError('Please enter a poll question.');
      return;
    }

    const cleanOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    if (cleanOptions.length < 2) {
      setFormError('Please provide at least 2 non-empty options.');
      return;
    }

    setSubmitting(true);
    try {
      if (socket) {
        // Emit via socket for instant broadcast
        socket.emit('poll-create', {
          roomId,
          question: question.trim(),
          options: cleanOptions,
          isAnonymous
        });
      } else {
        await meetingService.createMeetingPoll(roomId, {
          question: question.trim(),
          options: cleanOptions,
          isAnonymous
        });
        await fetchPolls();
      }

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setIsAnonymous(false);
      setIsCreating(false);
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to launch poll.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cast vote
  const handleVote = async (pollId, optionId) => {
    try {
      if (socket) {
        socket.emit('poll-vote', { roomId, pollId, optionId });
      } else {
        await meetingService.voteMeetingPoll(roomId, pollId, optionId, voterId);
        await fetchPolls();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to submit vote.');
    }
  };

  // End poll (Host only)
  const handleEndPoll = async (pollId) => {
    try {
      if (socket) {
        socket.emit('poll-end', { roomId, pollId });
      } else {
        await meetingService.endMeetingPoll(roomId, pollId);
        await fetchPolls();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to end poll.');
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed top-0 right-0 bottom-0 z-40 w-80 sm:w-96 bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 animate-slide-left">
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Meeting Polls</span>
              <Badge variant="success" size="sm">
                Live
              </Badge>
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {polls.filter((p) => p.isActive).length} active poll(s)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Bar (Create poll button for host) */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          All Polls ({polls.length})
        </span>

        {canCreate && !isCreating && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="text-xs py-1 px-2.5 flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Poll</span>
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New Poll Creation Form */}
        {isCreating && (
          <form
            onSubmit={handleCreatePoll}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Create Live Poll
              </h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Should we adopt GraphQL for the new service?"
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Options
              </label>
              <div className="space-y-1.5">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-2 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add another option</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="anonPoll"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="anonPoll" className="text-[11px] text-slate-600 dark:text-slate-400">
                Keep responses anonymous
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
              className="w-full justify-center text-xs mt-2"
            >
              {submitting ? 'Launching...' : 'Launch Poll'}
            </Button>
          </form>
        )}

        {/* List of Polls */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
            <span className="text-xs">Loading polls...</span>
          </div>
        ) : polls.length === 0 && !isCreating ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <Vote className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No polls yet
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {canCreate
                ? 'Create a quick poll to gather live feedback from participants.'
                : 'When the meeting host launches a poll, it will appear here for voting.'}
            </p>
          </div>
        ) : (
          polls.map((poll) => {
            const isActive = poll.isActive;

            return (
              <div
                key={poll.pollId}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                {/* Poll Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Created by {poll.creatorName}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                      {poll.question}
                    </h4>
                  </div>

                  <div className="shrink-0">
                    {isActive ? (
                      <Badge variant="success" size="sm" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        Closed
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Options / Live Results */}
                <div className="space-y-2 pt-1">
                  {poll.options?.map((opt) => {
                    const percentage = opt.percentage || 0;
                    const hasVotedThis = opt.hasVoted;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => isActive && handleVote(poll.pollId, opt.id)}
                        className={`p-2.5 rounded-xl border transition-all text-xs relative overflow-hidden ${
                          isActive ? 'cursor-pointer hover:border-brand-500' : 'cursor-default'
                        } ${
                          hasVotedThis
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                            : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/60'
                        }`}
                      >
                        {/* Progress Bar Fill */}
                        <div
                          style={{ width: `${percentage}%` }}
                          className="absolute inset-y-0 left-0 bg-brand-500/15 dark:bg-brand-500/20 transition-all duration-500 pointer-events-none"
                        />

                        {/* Content text */}
                        <div className="relative flex items-center justify-between z-10">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {hasVotedThis && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                            )}
                            <span>{opt.text}</span>
                          </span>

                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0 ml-2">
                            {percentage}% ({opt.voteCount || 0})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Poll Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{poll.totalVotes || 0} total vote(s)</span>

                  {canCreate && isActive && (
                    <button
                      onClick={() => handleEndPoll(poll.pollId)}
                      className="text-rose-500 hover:text-rose-600 font-semibold transition"
                    >
                      End Poll
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default PollsPanel;
