import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  ListTodo,
  FileCheck2,
  RefreshCw,
  Plus,
  Trash2,
  X,
  UserCheck
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import Button from '../common/Button';

const AIInsightsModal = ({ isOpen, onClose, roomId, meetingId, meetingTitle }) => {
  const activeMeetingId = roomId || meetingId;
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'action_items' | 'analytics'
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // New action item input
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const fetchInsights = useCallback(async () => {
    if (!activeMeetingId) return;
    try {
      setLoading(true);
      const data = await aiService.getInsights(activeMeetingId);
      setInsights(data);
    } catch (err) {
      console.warn('Failed to fetch AI insights:', err);
    } finally {
      setLoading(false);
    }
  }, [activeMeetingId]);

  useEffect(() => {
    if (isOpen && activeMeetingId) {
      fetchInsights();
    }
  }, [isOpen, activeMeetingId, fetchInsights]);

  const handleGenerateSummary = async () => {
    try {
      setGenerating(true);
      const updated = await aiService.generateSummary(activeMeetingId);
      setInsights(updated);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const updatedTask = await aiService.updateActionItem(activeMeetingId, task.taskId, {
        status: newStatus
      });

      setInsights((prev) => {
        if (!prev) return prev;
        const updatedList = (prev.actionItems || []).map((t) => (t.taskId === task.taskId ? updatedTask : t));
        const completedCount = updatedList.filter((t) => t.status === 'completed').length;
        return {
          ...prev,
          actionItems: updatedList,
          stats: {
            ...prev.stats,
            completedActionItems: completedCount,
            completionRate: Math.round((completedCount / updatedList.length) * 100)
          }
        };
      });
    } catch (err) {
      console.warn('Could not update task status:', err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const created = await aiService.createActionItem(activeMeetingId, {
        title: newTaskTitle.trim(),
        assigneeName: newTaskAssignee.trim() || 'Unassigned'
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');

      setInsights((prev) => {
        if (!prev) return prev;
        const updatedList = [...(prev.actionItems || []), created];
        return {
          ...prev,
          actionItems: updatedList
        };
      });
    } catch (err) {
      alert(err.message || 'Failed to add action item');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await aiService.deleteActionItem(activeMeetingId, taskId);
      setInsights((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actionItems: (prev.actionItems || []).filter((t) => t.taskId !== taskId)
        };
      });
    } catch (err) {
      console.warn('Failed to delete task:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                AI Meeting Summary & Productivity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {meetingTitle || `Meeting ${roomId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateSummary}
              isLoading={generating}
              className="flex items-center gap-1.5 py-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              Generate Summary
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 dark:border-slate-800 flex gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'summary'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            } flex items-center gap-1.5`}
          >
            <FileCheck2 className="w-4 h-4" />
            Summary & Decisions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('action_items')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'action_items'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            } flex items-center gap-1.5`}
          >
            <ListTodo className="w-4 h-4" />
            Action Items ({insights?.actionItems?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'analytics'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            } flex items-center gap-1.5`}
          >
            <Clock className="w-4 h-4" />
            Insights & Topics
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin" />
              <p>Analyzing meeting transcript & notes...</p>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-900/40">
                <h4 className="font-bold text-brand-900 dark:text-brand-300 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Executive Summary
                </h4>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm">
                  {insights?.summary || 'No summary generated yet. Click "Generate Summary" above to synthesize discussions.'}
                </p>
              </div>

              {/* Key Discussion Points */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
                  Key Discussion Points
                </h4>
                {insights?.keyPoints?.length > 0 ? (
                  <ul className="space-y-2">
                    {insights.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No discussion points cataloged yet.</p>
                )}
              </div>

              {/* Decisions Made */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
                  Decisions Made
                </h4>
                {insights?.decisions?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {insights.decisions.map((decision, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{decision}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No formal decisions recorded yet.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'action_items' ? (
            <div className="space-y-5">
              {/* Add New Task Form */}
              <form onSubmit={handleCreateTask} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Task title (e.g. Deploy WebRTC mesh update)..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-800 focus:border-brand-500 outline-none transition"
                />
                <input
                  type="text"
                  placeholder="Assignee (e.g. Elena)..."
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-36 px-3 py-2 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-800 focus:border-brand-500 outline-none transition"
                />
                <Button type="submit" size="sm" variant="primary" className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </form>

              {/* Task Items List */}
              <div className="space-y-2.5">
                {insights?.actionItems?.length > 0 ? (
                  insights.actionItems.map((task) => {
                    const isDone = task.status === 'completed';
                    return (
                      <div
                        key={task.taskId}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          isDone
                            ? 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-slate-800/60 opacity-60'
                            : 'bg-white dark:bg-dark-800 border-slate-200 dark:border-slate-700 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(task)}
                            className="text-slate-400 hover:text-emerald-500 transition cursor-pointer flex-shrink-0"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-current" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                              {task.title}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <UserCheck className="w-3 h-3 text-brand-500" />
                              {task.assigneeName || 'Unassigned'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.taskId)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No action items yet. Extract from transcript or add one above.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Meeting Metrics Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Meeting Duration</span>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {Math.round((insights?.duration || 1800) / 60)} minutes
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Task Completion</span>
                  <div className="text-xl font-bold text-emerald-500 mt-1">
                    {insights?.stats?.completionRate || 0}%
                  </div>
                </div>
              </div>

              {/* Topics Discovered */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Important Topics Discussed
                </h4>
                <div className="flex flex-wrap gap-2">
                  {insights?.topics?.map((topic, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsightsModal;
